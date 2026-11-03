import { createTestApp, login, type TestContext } from './helpers.js';

describe('Permissões OWNER vs PROFESSIONAL (e2e)', () => {
  let ctx: TestContext;
  let owner: string;
  let barber: string;
  let rafaelId: string;
  let diegoId: string;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const plus = (days: number) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + days * 86_400_000));

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await login(ctx, 'demo@agendai.app');
    barber = await login(ctx, 'barbeiro@agendai.app');
    rafaelId = (await ctx.prisma.professional.findFirstOrThrow({ where: { name: 'Rafael Montes' } })).id;
    diegoId = (await ctx.prisma.professional.findFirstOrThrow({ where: { name: 'Diego Albuquerque' } })).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('rotas do painel exigem login', async () => {
    await ctx.http().get('/admin/dashboard').expect(401);
    await ctx.http().get('/admin/appointments').query({ from: today, to: today }).expect(401);
    await ctx.http().get('/auth/me').set('Cookie', 'agendai_session=invalido').expect(401);
  });

  it('login inválido devolve 401 com mensagem amigável', async () => {
    const res = await ctx.http().post('/auth/login').send({ email: 'demo@agendai.app', password: 'errada123' }).expect(401);
    expect(res.body.message).toBe('E-mail ou senha incorretos.');
  });

  it('/auth/me identifica o papel', async () => {
    const me = await ctx.http().get('/auth/me').set('Cookie', barber).expect(200);
    expect(me.body).toMatchObject({ role: 'PROFESSIONAL', professionalId: rafaelId });
    const meOwner = await ctx.http().get('/auth/me').set('Cookie', owner).expect(200);
    expect(meOwner.body.role).toBe('OWNER');
  });

  it('OWNER vê a agenda de todos; PROFESSIONAL só a própria', async () => {
    const all = await ctx.http().get('/admin/appointments').query({ from: plus(-7), to: plus(7) }).set('Cookie', owner).expect(200);
    const proIds = new Set(all.body.appointments.map((a: { professional: { id: string } }) => a.professional.id));
    expect(proIds.size).toBeGreaterThan(1);

    const mine = await ctx.http().get('/admin/appointments').query({ from: plus(-7), to: plus(7) }).set('Cookie', barber).expect(200);
    expect(mine.body.appointments.length).toBeGreaterThan(0);
    for (const a of mine.body.appointments) expect(a.professional.id).toBe(rafaelId);

    await ctx
      .http()
      .get('/admin/appointments')
      .query({ from: today, to: today, professionalId: diegoId })
      .set('Cookie', barber)
      .expect(403);
  });

  it('PROFESSIONAL não acessa configurações, clientes nem cadastros', async () => {
    await ctx.http().get('/admin/business').set('Cookie', barber).expect(403);
    await ctx.http().get('/admin/customers').set('Cookie', barber).expect(403);
    await ctx.http().post('/admin/services').set('Cookie', barber).send({ name: 'X', durationMinutes: 30, priceCents: 100 }).expect(403);
    await ctx.http().get('/admin/business').set('Cookie', owner).expect(200);
    await ctx.http().get('/admin/customers').set('Cookie', owner).expect(200);
  });

  it('PROFESSIONAL não muda status de agendamento de outro profissional', async () => {
    const other = await ctx.prisma.appointment.findFirstOrThrow({
      where: { professionalId: diegoId, status: 'SCHEDULED', startsAt: { gt: new Date() } },
    });
    await ctx.http().patch(`/admin/appointments/${other.id}/status`).set('Cookie', barber).send({ status: 'CONFIRMED' }).expect(403);
    await ctx.http().patch(`/admin/appointments/${other.id}/status`).set('Cookie', owner).send({ status: 'CONFIRMED' }).expect(200);
  });

  it('regras de status: não conclui agendamento futuro; conclui um passado', async () => {
    const future = await ctx.prisma.appointment.findFirstOrThrow({
      where: { professionalId: rafaelId, status: { in: ['SCHEDULED', 'CONFIRMED'] }, startsAt: { gt: new Date() } },
    });
    const res = await ctx.http().patch(`/admin/appointments/${future.id}/status`).set('Cookie', barber).send({ status: 'COMPLETED' }).expect(422);
    expect(res.body.message).toContain('ainda não começou');

    const past = await ctx.prisma.appointment.create({
      data: {
        ...(({ id: _i, code: _c, manageToken: _t, createdAt: _a, updatedAt: _u, ...rest }) => rest)(future),
        startsAt: new Date('2020-01-01T12:00:00Z'),
        endsAt: new Date('2020-01-01T12:45:00Z'),
        status: 'CONFIRMED',
        code: 'TST-PST',
        manageToken: 'token-past-e2e',
      },
    });
    const ok = await ctx.http().patch(`/admin/appointments/${past.id}/status`).set('Cookie', barber).send({ status: 'COMPLETED' }).expect(200);
    expect(ok.body.status).toBe('COMPLETED');
    await ctx.http().patch(`/admin/appointments/${past.id}/status`).set('Cookie', barber).send({ status: 'INVALIDO' }).expect(400);
  });

  it('PROFESSIONAL cria bloqueio apenas na própria agenda', async () => {
    const res = await ctx
      .http()
      .post('/admin/time-offs')
      .set('Cookie', barber)
      .send({ startsAt: '2030-01-01T12:00:00.000Z', endsAt: '2030-01-01T15:00:00.000Z', reason: 'Dentista' })
      .expect(201);
    expect(res.body.professionalId).toBe(rafaelId);
    await ctx
      .http()
      .post('/admin/time-offs')
      .set('Cookie', barber)
      .send({ professionalId: diegoId, startsAt: '2030-01-01T12:00:00.000Z', endsAt: '2030-01-01T15:00:00.000Z' })
      .expect(403);
  });

  it('dashboard do PROFESSIONAL considera só a própria agenda', async () => {
    const own = await ctx.http().get('/admin/dashboard').set('Cookie', barber).expect(200);
    const all = await ctx.http().get('/admin/dashboard').set('Cookie', owner).expect(200);
    expect(own.body.series).toHaveLength(30);
    expect(all.body.realizedRevenueMonthCents).toBeGreaterThanOrEqual(own.body.realizedRevenueMonthCents);
    for (const a of own.body.upcoming) expect(a.professional.id).toBe(rafaelId);
  });

  it('logout limpa o cookie', async () => {
    const res = await ctx.http().post('/auth/logout').set('Cookie', owner).expect(204);
    expect(res.get('Set-Cookie')?.[0]).toMatch(/agendai_session=;/);
  });

  it('reset da demo exige o CRON_SECRET', async () => {
    await ctx.http().post('/internal/reset-demo').expect(401);
    await ctx.http().get('/internal/reset-demo').set('Authorization', 'Bearer errado').expect(401);
    const res = await ctx.http().get('/internal/reset-demo').set('Authorization', 'Bearer e2e-cron-secret').expect(200);
    expect(res.body.ok).toBe(true);
  });
});
