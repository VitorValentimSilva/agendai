import { createHmac } from 'node:crypto';
import { createTestApp, findFreeSlot, login, type TestContext } from './helpers.js';

const CRON = { Authorization: 'Bearer e2e-cron-secret' };

describe('Lembretes e confirmação por WhatsApp (e2e, modo simulado)', () => {
  let ctx: TestContext;
  let owner: string;
  let serviceId: string;

  async function book(name: string, whatsapp: string) {
    const slot = await findFreeSlot(ctx, serviceId, 'any');
    const res = await ctx
      .http()
      .post('/appointments')
      .send({ serviceId, professionalId: 'any', startsAt: slot.start, customer: { name, whatsapp } })
      .expect(201);
    return ctx.prisma.appointment.findUniqueOrThrow({ where: { code: res.body.code }, include: { customer: true } });
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await login(ctx, 'demo@agendai.app');
    // Janela grande para o teste não depender da hora em que roda
    await ctx.prisma.business.update({ where: { slug: 'navalha-de-ouro' }, data: { reminderHoursBefore: 72 } });
    serviceId = (await ctx.http().get('/services').expect(200)).body[0].id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('cron envia lembretes devidos uma única vez', async () => {
    const a = await book('Lembrete Teste', '(19) 97777-1111');
    await ctx.http().get('/internal/send-reminders').expect(401);
    const first = await ctx.http().get('/internal/send-reminders').set(CRON).expect(200);
    expect(first.body.sent).toBeGreaterThan(0);

    const after = await ctx.prisma.appointment.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.reminderSentAt).not.toBeNull();
    const log = await ctx.prisma.messageLog.findFirstOrThrow({ where: { appointmentId: a.id, kind: 'reminder' } });
    expect(log).toMatchObject({ provider: 'SIMULATED', status: 'sent', direction: 'OUT' });
    expect(log.body).toContain('Responda *1*');

    const second = await ctx.http().get('/internal/send-reminders').set(CRON).expect(200);
    expect(second.body.sent).toBe(0);
  });

  it('resposta "1" (simulada no painel) confirma o agendamento', async () => {
    const a = await book('Confirma Teste', '(19) 97777-2222');
    await ctx.http().post(`/admin/appointments/${a.id}/remind`).set('Cookie', owner).expect(200);
    const res = await ctx
      .http()
      .post('/admin/messages/simulate-reply')
      .set('Cookie', owner)
      .send({ appointmentId: a.id, reply: '1' })
      .expect(200);
    expect(res.body).toEqual({ handled: true, action: 'confirmed' });
    const after = await ctx.prisma.appointment.findUniqueOrThrow({ where: { id: a.id } });
    expect(after).toMatchObject({ status: 'CONFIRMED', confirmedVia: 'WHATSAPP' });

    const messages = await ctx.http().get('/admin/messages').set('Cookie', owner).expect(200);
    const kinds = messages.body.filter((m: { appointmentId: string }) => m.appointmentId === a.id).map((m: { kind: string }) => m.kind);
    expect(kinds).toEqual(expect.arrayContaining(['reminder', 'inbound', 'reply']));
  });

  it('webhook da Meta: verificação, assinatura e cancelamento por "2"', async () => {
    await ctx
      .http()
      .get('/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'e2e-verify-token', 'hub.challenge': 'abc123' })
      .expect(200, 'abc123');
    await ctx.http().get('/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'errado' }).expect(403);

    const a = await book('Cancela Teste', '(19) 97777-3333');
    await ctx.http().post(`/admin/appointments/${a.id}/remind`).set('Cookie', owner).expect(200);

    // O WhatsApp entrega o número sem o nono dígito: precisa encontrar mesmo assim
    const from = a.customer.whatsapp.replace(/^55(\d{2})9/, '55$1');
    const body = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ id: 'wamid.1', from, type: 'text', text: { body: '2' } }] } }] }],
    });
    const signature = `sha256=${createHmac('sha256', 'e2e-meta-app-secret').update(body).digest('hex')}`;

    await ctx.http().post('/webhooks/whatsapp').set('Content-Type', 'application/json').set('X-Hub-Signature-256', 'sha256=00').send(body).expect(401);
    const res = await ctx
      .http()
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .send(body)
      .expect(200);
    expect(res.body).toEqual({ received: true, handled: 1 });
    const after = await ctx.prisma.appointment.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.status).toBe('CANCELED');
  });

  it('PROFESSIONAL não simula respostas e só vê mensagens da própria agenda', async () => {
    const barber = await login(ctx, 'barbeiro@agendai.app');
    await ctx.http().post('/admin/messages/simulate-reply').set('Cookie', barber).send({ appointmentId: 'x', reply: '1' }).expect(403);
    const mine = await ctx.http().get('/admin/messages').set('Cookie', barber).expect(200);
    const me = await ctx.http().get('/auth/me').set('Cookie', barber).expect(200);
    for (const m of mine.body as Array<{ appointmentId: string | null }>) {
      if (!m.appointmentId) continue;
      const appt = await ctx.prisma.appointment.findUniqueOrThrow({ where: { id: m.appointmentId } });
      expect(appt.professionalId).toBe(me.body.professionalId);
    }
  });
});
