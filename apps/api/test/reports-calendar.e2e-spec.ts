import { createTestApp, findFreeSlot, login, type TestContext } from './helpers.js';
import { GoogleClient } from '../src/calendar/google.client.js';

/** Google falso: registra as chamadas de sincronização. */
const fakeGoogle = {
  enabled: true,
  calls: [] as Array<{ op: string; eventId?: string | null; summary?: string; status?: string }>,
  authUrl: (state: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
  async exchangeCode() {
    return { refreshToken: 'refresh-123', email: 'rafael@gmail.example' };
  },
  async accessToken() {
    return 'access-xyz';
  },
  async upsertEvent(_t: string, _c: string, eventId: string | null, body: { summary: string; status: string }) {
    fakeGoogle.calls.push({ op: 'upsert', eventId, summary: body.summary, status: body.status });
    return eventId ?? `gev_${fakeGoogle.calls.length}`;
  },
  async deleteEvent(_t: string, _c: string, eventId: string) {
    fakeGoogle.calls.push({ op: 'delete', eventId });
  },
  async revoke() {},
};

describe('Relatórios, CSV, feed iCal e Google Calendar (e2e)', () => {
  let ctx: TestContext;
  let owner: string;
  let barber: string;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const monthAgo = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() - 30 * 86_400_000));

  beforeAll(async () => {
    ctx = await createTestApp((b) => b.overrideProvider(GoogleClient).useValue(fakeGoogle));
    owner = await login(ctx, 'demo@agendai.app');
    barber = await login(ctx, 'barbeiro@agendai.app');
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('relatório com comissões bate com o banco', async () => {
    const pros = (await ctx.http().get('/admin/professionals').set('Cookie', owner).expect(200)).body as Array<{ id: string; name: string }>;
    await ctx.http().patch(`/admin/professionals/${pros[0]!.id}`).set('Cookie', owner).send({ commissionPercent: 50 }).expect(200);
    await ctx.http().patch(`/admin/professionals/${pros[0]!.id}`).set('Cookie', owner).send({ commissionPercent: 150 }).expect(400);

    const res = await ctx.http().get('/admin/reports').query({ from: monthAgo, to: today }).set('Cookie', owner).expect(200);
    const first = res.body.professionals.find((p: { professionalId: string }) => p.professionalId === pros[0]!.id);
    expect(first.commissionPercent).toBe(50);
    expect(first.commissionCents).toBe(Math.round(first.revenueCents * 0.5));

    const completed = await ctx.prisma.appointment.aggregate({
      where: {
        business: { slug: 'navalha-de-ouro' },
        status: 'COMPLETED',
        startsAt: { gte: new Date(`${monthAgo}T03:00:00Z`), lt: new Date(new Date(`${today}T03:00:00Z`).getTime() + 86_400_000) },
      },
      _sum: { priceCents: true },
    });
    expect(res.body.totals.revenueCents).toBe(completed._sum.priceCents);
    expect(res.body.totals.netRevenueCents).toBe(res.body.totals.revenueCents - res.body.totals.commissionCents);

    await ctx.http().get('/admin/reports').query({ from: today, to: monthAgo }).set('Cookie', owner).expect(400);
  });

  it('PROFESSIONAL vê só o próprio relatório', async () => {
    const me = (await ctx.http().get('/auth/me').set('Cookie', barber).expect(200)).body;
    const res = await ctx.http().get('/admin/reports').query({ from: monthAgo, to: today }).set('Cookie', barber).expect(200);
    expect(res.body.professionals.every((p: { professionalId: string }) => p.professionalId === me.professionalId)).toBe(true);
  });

  it('exporta CSV no padrão do Excel pt-BR', async () => {
    const res = await ctx.http().get('/admin/reports/appointments.csv').query({ from: monthAgo, to: today }).set('Cookie', owner).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    const text = res.text;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const [header, line] = text.slice(1).split('\r\n');
    expect(header).toBe('Data;Hora;Código;Cliente;WhatsApp;Serviço;Profissional;Status;Origem;Valor (R$);Comissão (R$);Pix;Confirmado via');
    expect(line!.split(';')[9]).toMatch(/^\d+,\d{2}$/);
  });

  it('feed iCal: gerar, assinar e revogar (PROFESSIONAL só o próprio)', async () => {
    const me = (await ctx.http().get('/auth/me').set('Cookie', barber).expect(200)).body;
    const pros = (await ctx.http().get('/admin/professionals').set('Cookie', owner).expect(200)).body as Array<{ id: string }>;
    const other = pros.find((p) => p.id !== me.professionalId)!;
    await ctx.http().post(`/admin/professionals/${other.id}/calendar-feed`).set('Cookie', barber).expect(403);

    const created = await ctx.http().post(`/admin/professionals/${me.professionalId}/calendar-feed`).set('Cookie', barber).expect(200);
    const path = new URL(created.body.url).pathname;
    expect(path).toMatch(/^\/calendar\/[A-Za-z0-9_-]+\.ics$/);
    const feed = await ctx.http().get(path).expect(200);
    expect(feed.headers['content-type']).toContain('text/calendar');
    expect(feed.text).toContain('BEGIN:VCALENDAR');
    expect(feed.text).toContain('BEGIN:VEVENT');

    await ctx.http().delete(`/admin/professionals/${me.professionalId}/calendar-feed`).set('Cookie', barber).expect(204);
    await ctx.http().get(path).expect(404);
  });

  it('Google Calendar: conecta via OAuth e acompanha criação e cancelamento', async () => {
    const me = (await ctx.http().get('/auth/me').set('Cookie', barber).expect(200)).body;
    const connect = await ctx.http().get(`/admin/professionals/${me.professionalId}/google/connect`).set('Cookie', barber).expect(200);
    const state = new URL(connect.body.url).searchParams.get('state')!;

    await ctx.http().get('/integrations/google/callback').query({ code: 'c', state: 'adulterado' }).expect(302).expect('location', /google=erro/);
    await ctx.http().get('/integrations/google/callback').query({ code: 'c', state }).expect(302).expect('location', /google=ok/);
    const pro = await ctx.prisma.professional.findUniqueOrThrow({ where: { id: me.professionalId } });
    expect(pro.googleEmail).toBe('rafael@gmail.example');
    expect(pro.googleRefreshTokenEnc).not.toContain('refresh-123');

    const serviceId = (await ctx.http().get(`/services`).expect(200)).body[0].id;
    const slot = await findFreeSlot(ctx, serviceId, me.professionalId);
    fakeGoogle.calls.length = 0;
    const booked = await ctx
      .http()
      .post('/appointments')
      .send({ serviceId, professionalId: me.professionalId, startsAt: slot.start, customer: { name: 'Google Sync', whatsapp: '(19) 94444-1111' } })
      .expect(201);
    expect(fakeGoogle.calls[0]).toMatchObject({ op: 'upsert', eventId: null, summary: expect.stringContaining('Google Sync'), status: 'confirmed' });
    const appt = await ctx.prisma.appointment.findUniqueOrThrow({ where: { code: booked.body.code } });
    expect(appt.googleEventId).toBe('gev_1');

    await ctx.http().post(`/appointments/manage/${booked.body.manageToken}/cancel`).expect(201);
    expect(fakeGoogle.calls.at(-1)).toEqual({ op: 'delete', eventId: 'gev_1' });

    await ctx.http().delete(`/admin/professionals/${me.professionalId}/google`).set('Cookie', barber).expect(204);
    const after = await ctx.prisma.professional.findUniqueOrThrow({ where: { id: me.professionalId } });
    expect(after.googleRefreshTokenEnc).toBeNull();
  });

  it('status das integrações', async () => {
    const res = await ctx.http().get('/admin/integrations').set('Cookie', owner).expect(200);
    expect(res.body).toEqual({ whatsapp: 'SIMULATED', pix: 'SIMULATED', google: true });
  });
});
