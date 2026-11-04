import { createTestApp, findFreeSlot, login, type TestContext } from './helpers.js';

describe('Fila de espera (e2e)', () => {
  let ctx: TestContext;
  let owner: string;
  let serviceId: string;
  let professionalId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await login(ctx, 'demo@agendai.app');
    serviceId = (await ctx.http().get('/services').expect(200)).body.find((s: { name: string }) => s.name === 'Corte').id;
    professionalId = (await ctx.http().get(`/services/${serviceId}/professionals`).expect(200)).body[0].id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('avisa quem está na fila quando um horário é liberado e marca como atendido ao agendar', async () => {
    // Deixa só um horário livre no dia para este profissional e ocupa esse horário
    const slot = await findFreeSlot(ctx, serviceId, professionalId);
    const { slots } = (await ctx.http().get('/availability').query({ serviceId, professionalId, date: slot.date }).expect(200)).body as {
      slots: Array<{ start: string; end: string }>;
    };
    const keep = slots[0]!;
    const business = await ctx.prisma.business.findUniqueOrThrow({ where: { slug: 'navalha-de-ouro' } });
    const dayStart = new Date(`${slot.date}T00:00:00-03:00`);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    await ctx.prisma.timeOff.createMany({
      data: [
        { businessId: business.id, professionalId, startsAt: dayStart, endsAt: new Date(keep.start), reason: 'teste' },
        { businessId: business.id, professionalId, startsAt: new Date(keep.end), endsAt: dayEnd, reason: 'teste' },
      ],
    });
    const booked = await ctx
      .http()
      .post('/appointments')
      .send({ serviceId, professionalId, startsAt: keep.start, customer: { name: 'Ocupa Vaga', whatsapp: '(19) 95555-1111' } })
      .expect(201);
    const none = await ctx.http().get('/availability').query({ serviceId, professionalId, date: slot.date }).expect(200);
    expect(none.body.slots).toHaveLength(0);

    // Cliente entra na fila
    const joined = await ctx
      .http()
      .post('/waitlist')
      .send({ serviceId, professionalId, date: slot.date, customer: { name: 'Fila Espera', whatsapp: '(19) 95555-2222' } })
      .expect(201);
    expect(joined.body).toMatchObject({ status: 'ACTIVE', date: slot.date, serviceName: 'Corte' });
    // Entrar de novo não duplica
    await ctx
      .http()
      .post('/waitlist')
      .send({ serviceId, professionalId, date: slot.date, customer: { name: 'Fila Espera', whatsapp: '(19) 95555-2222' } })
      .expect(201);
    expect(await ctx.prisma.waitlistEntry.count({ where: { date: slot.date, customer: { whatsapp: '5519955552222' } } })).toBe(1);

    // Cancelamento libera o horário → aviso por WhatsApp (simulado) com link de agendamento
    await ctx.http().post(`/appointments/manage/${booked.body.manageToken}/cancel`).expect(201);
    const entry = await ctx.prisma.waitlistEntry.findFirstOrThrow({ where: { token: joined.body.token } });
    expect(entry.status).toBe('NOTIFIED');
    const message = await ctx.prisma.messageLog.findFirstOrThrow({ where: { kind: 'waitlist', customerId: entry.customerId } });
    expect(message.body).toContain(`/n/navalha-de-ouro/agendar?servico=${serviceId}&data=${slot.date}`);

    // Ela agenda → sai da fila como atendida
    await ctx
      .http()
      .post('/appointments')
      .send({ serviceId, professionalId, startsAt: keep.start, customer: { name: 'Fila Espera', whatsapp: '(19) 95555-2222' } })
      .expect(201);
    expect((await ctx.prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } })).status).toBe('BOOKED');

    // Painel lista a fila
    const list = await ctx.http().get('/admin/waitlist').set('Cookie', owner).expect(200);
    expect(list.body.find((e: { id: string }) => e.id === entry.id)).toMatchObject({ status: 'BOOKED', customerName: 'Fila Espera' });
  });

  it('valida a data, permite sair da fila e restringe o painel do PROFESSIONAL', async () => {
    await ctx
      .http()
      .post('/waitlist')
      .send({ serviceId, professionalId: 'any', date: '2020-01-01', customer: { name: 'Antiga', whatsapp: '(19) 95555-3333' } })
      .expect(400);

    const slot = await findFreeSlot(ctx, serviceId, 'any');
    const joined = await ctx
      .http()
      .post('/waitlist')
      .send({ serviceId, professionalId: 'any', date: slot.date, customer: { name: 'Vai Sair', whatsapp: '(19) 95555-4444' } })
      .expect(201);
    await ctx.http().post(`/waitlist/${joined.body.token}/leave`).expect(204);
    await ctx.http().post(`/waitlist/${joined.body.token}/leave`).expect(404);

    const barber = await login(ctx, 'barbeiro@agendai.app');
    const me = (await ctx.http().get('/auth/me').set('Cookie', barber).expect(200)).body;
    const mine = await ctx.http().get('/admin/waitlist').set('Cookie', barber).expect(200);
    for (const e of mine.body as Array<{ professionalId: string | null }>) {
      expect([null, me.professionalId]).toContain(e.professionalId);
    }
  });
});
