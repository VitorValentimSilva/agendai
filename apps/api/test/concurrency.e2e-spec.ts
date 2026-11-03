import { createTestApp, findFreeSlot, type TestContext } from './helpers.js';

describe('Concorrência — sem agendamento duplo (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('10 reservas simultâneas do mesmo horário/profissional: só 1 passa, 9 recebem 409', async () => {
    const services = await ctx.http().get('/services').expect(200);
    const serviceId: string = services.body.find((s: { name: string }) => s.name === 'Corte + Barba').id;
    const pros = await ctx.http().get(`/services/${serviceId}/professionals`).expect(200);
    const professionalId: string = pros.body[0].id;
    const slot = await findFreeSlot(ctx, serviceId, professionalId);

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        ctx
          .http()
          .post('/appointments')
          .send({
            serviceId,
            professionalId,
            startsAt: slot.start,
            customer: { name: `Cliente Concorrente ${i}`, whatsapp: `(19) 9${String(70000000 + i).padStart(8, '0')}` },
          }),
      ),
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    for (const r of responses.filter((x) => x.status === 409)) {
      expect(r.body.message).toMatch(/horário/i);
    }

    const stored = await ctx.prisma.appointment.count({
      where: { professionalId, startsAt: new Date(slot.start), status: { not: 'CANCELED' } },
    });
    expect(stored).toBe(1);
  });

  it('o banco recusa sobreposição mesmo inserindo direto (exclusion constraint)', async () => {
    const existing = await ctx.prisma.appointment.findFirstOrThrow({ where: { status: 'CONFIRMED' } });
    const { id: _id, code: _code, manageToken: _token, createdAt: _c, updatedAt: _u, ...rest } = existing;
    await expect(
      ctx.prisma.appointment.create({
        data: {
          ...rest,
          startsAt: new Date(existing.startsAt.getTime() + 5 * 60_000),
          endsAt: new Date(existing.endsAt.getTime() + 5 * 60_000),
          code: 'DUP-123',
          manageToken: 'dup-token',
        },
      }),
    ).rejects.toThrow(/Appointment_no_overlap|23P01|exclusion/i);

    // Um agendamento CANCELADO no mesmo horário é permitido
    const ok = await ctx.prisma.appointment.create({
      data: { ...rest, status: 'CANCELED', code: 'CAN-123', manageToken: 'can-token' },
    });
    expect(ok.status).toBe('CANCELED');
  });
});
