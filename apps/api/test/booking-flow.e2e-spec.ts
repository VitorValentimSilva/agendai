import { createTestApp, findFreeSlot, login, type TestContext } from './helpers.js';

describe('Fluxo de agendamento (e2e)', () => {
  let ctx: TestContext;
  let serviceId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    const services = await ctx.http().get('/services').expect(200);
    serviceId = services.body.find((s: { name: string }) => s.name === 'Corte').id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /health responde ok', async () => {
    const res = await ctx.http().get('/health').expect(200);
    expect(res.text).toBe('ok');
  });

  it('expõe dados públicos do negócio, serviços e profissionais', async () => {
    const business = await ctx.http().get('/business').expect(200);
    expect(business.body).toMatchObject({ name: 'Barbearia Navalha de Ouro', timezone: 'America/Sao_Paulo' });
    expect(business.body.openingHours).toHaveLength(7);

    const services = await ctx.http().get('/services').expect(200);
    expect(services.body).toHaveLength(6);

    const pros = await ctx.http().get(`/services/${serviceId}/professionals`).expect(200);
    expect(pros.body.map((p: { name: string }) => p.name)).toEqual(['Rafael Montes', 'Diego Albuquerque', 'Lucas Ferraz']);
  });

  it('valida a entrada (400) e recusa horário fora da agenda (409)', async () => {
    await ctx.http().post('/appointments').send({ serviceId }).expect(400);
    await ctx
      .http()
      .post('/appointments')
      .send({
        serviceId,
        professionalId: 'any',
        startsAt: '2020-01-01T12:00:00.000Z',
        customer: { name: 'Teste', whatsapp: '(19) 99999-0000' },
      })
      .expect(409);
    await ctx.http().get('/availability').query({ serviceId, professionalId: 'any', date: '03/11/2026' }).expect(400);
  });

  it('agendar → aparece no painel → cliente cancela pelo link', async () => {
    const slot = await findFreeSlot(ctx, serviceId, 'any');

    // 1) Cliente agenda com "qualquer profissional"
    const created = await ctx
      .http()
      .post('/appointments')
      .send({
        serviceId,
        professionalId: 'any',
        startsAt: slot.start,
        customer: { name: 'Cliente E2E', whatsapp: '(19) 98888-7777', email: 'e2e@example.com' },
        notes: 'Primeira vez',
      })
      .expect(201);
    expect(created.body.code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    expect(created.body.manageToken).toEqual(expect.any(String));
    expect(created.body.status).toBe('SCHEDULED');
    expect(created.body.manage.canChange).toBe(true);
    expect(slot.professionalIds).toContain(created.body.professional.id);
    const token: string = created.body.manageToken;

    // O horário deixa de ser oferecido para aquele profissional
    const after = await ctx
      .http()
      .get('/availability')
      .query({ serviceId, professionalId: created.body.professional.id, date: slot.date })
      .expect(200);
    expect(after.body.slots.map((s: { start: string }) => s.start)).not.toContain(slot.start);

    // 2) Dono vê na agenda do painel
    const cookie = await login(ctx, 'demo@agendai.app');
    const agenda = await ctx.http().get('/admin/appointments').query({ from: slot.date, to: slot.date }).set('Cookie', cookie).expect(200);
    const found = agenda.body.appointments.find((a: { code: string }) => a.code === created.body.code);
    expect(found).toMatchObject({ status: 'SCHEDULED', source: 'ONLINE', customer: { name: 'Cliente E2E', whatsapp: '5519988887777' } });

    // .ics
    const ics = await ctx.http().get(`/appointments/manage/${token}/ics`).expect(200);
    expect(ics.headers['content-type']).toContain('text/calendar');
    expect(ics.text).toContain('BEGIN:VEVENT');
    expect(ics.text).toContain(created.body.code);

    // 3) Cliente consulta e cancela pelo link
    const view = await ctx.http().get(`/appointments/manage/${token}`).expect(200);
    expect(view.body.code).toBe(created.body.code);
    expect(view.body).not.toHaveProperty('manageToken');

    const canceled = await ctx.http().post(`/appointments/manage/${token}/cancel`).expect(201);
    expect(canceled.body.status).toBe('CANCELED');
    expect(canceled.body.manage.canChange).toBe(false);

    // Painel reflete o cancelamento e o horário volta a ficar livre
    const agenda2 = await ctx.http().get('/admin/appointments').query({ from: slot.date, to: slot.date }).set('Cookie', cookie).expect(200);
    expect(agenda2.body.appointments.find((a: { code: string }) => a.code === created.body.code).status).toBe('CANCELED');
    const free = await ctx
      .http()
      .get('/availability')
      .query({ serviceId, professionalId: created.body.professional.id, date: slot.date })
      .expect(200);
    expect(free.body.slots.map((s: { start: string }) => s.start)).toContain(slot.start);

    // Não dá para cancelar duas vezes
    await ctx.http().post(`/appointments/manage/${token}/cancel`).expect(422);
  });

  it('cliente remarca pelo link para outro horário livre', async () => {
    const pros = await ctx.http().get(`/services/${serviceId}/professionals`).expect(200);
    const proId: string = pros.body[0].id;
    const slot = await findFreeSlot(ctx, serviceId, proId);
    const created = await ctx
      .http()
      .post('/appointments')
      .send({ serviceId, professionalId: proId, startsAt: slot.start, customer: { name: 'Remarca', whatsapp: '19977776666' } })
      .expect(201);

    const options = await ctx.http().get('/availability').query({ serviceId, professionalId: proId, date: slot.date }).expect(200);
    const target = options.body.slots.find((s: { start: string }) => s.start !== slot.start);
    const res = await ctx
      .http()
      .post(`/appointments/manage/${created.body.manageToken}/reschedule`)
      .send({ startsAt: target.start })
      .expect(201);
    expect(res.body.startsAt).toBe(target.start);
    expect(new Date(res.body.endsAt).getTime() - new Date(res.body.startsAt).getTime()).toBe(45 * 60_000);
  });

  it('política de cancelamento: bloqueia alteração em cima da hora', async () => {
    const business = await ctx.prisma.business.findFirstOrThrow();
    await ctx.prisma.business.update({ where: { id: business.id }, data: { cancellationPolicyHours: 24 * 40 } });
    try {
      const slot = await findFreeSlot(ctx, serviceId, 'any');
      const created = await ctx
        .http()
        .post('/appointments')
        .send({ serviceId, professionalId: 'any', startsAt: slot.start, customer: { name: 'Politica', whatsapp: '19966665555' } })
        .expect(201);
      expect(created.body.manage.canChange).toBe(false);
      const res = await ctx.http().post(`/appointments/manage/${created.body.manageToken}/cancel`).expect(422);
      expect(res.body.message).toContain('WhatsApp');
    } finally {
      await ctx.prisma.business.update({ where: { id: business.id }, data: { cancellationPolicyHours: 2 } });
    }
  });

  it('"qualquer profissional" escolhe o livre com menos agendamentos no dia', async () => {
    const slot = await findFreeSlot(ctx, serviceId, 'any');
    // Recalcula as contagens do dia para os candidatos
    const startOfDay = new Date(`${slot.date}T03:00:00.000Z`);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
    const counts = await Promise.all(
      slot.professionalIds.map(async (id) => ({
        id,
        count: await ctx.prisma.appointment.count({
          where: { professionalId: id, status: { not: 'CANCELED' }, startsAt: { gte: startOfDay, lt: endOfDay } },
        }),
      })),
    );
    const min = Math.min(...counts.map((c) => c.count));
    const expected = counts.filter((c) => c.count === min).map((c) => c.id)[0];
    const created = await ctx
      .http()
      .post('/appointments')
      .send({ serviceId, professionalId: 'any', startsAt: slot.start, customer: { name: 'Qualquer', whatsapp: '19955554444' } })
      .expect(201);
    expect(created.body.professional.id).toBe(expected);
  });

  it('token inexistente devolve 404', async () => {
    await ctx.http().get('/appointments/manage/nao-existe').expect(404);
  });
});
