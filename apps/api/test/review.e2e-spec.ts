import { JwtService } from '@nestjs/jwt';
import { createTestApp, findFreeSlot, login, type TestContext } from './helpers.js';
import { PaymentsService } from '../src/payments/payments.service.js';
import { MessagingService } from '../src/messaging/messaging.service.js';
import { DEMO_BARBER_EMAIL, DEMO_OWNER_EMAIL, DEMO_SLUG } from '../src/demo/demo-data.js';

/** Regressões da revisão de segurança/concorrência. */
describe('Revisão: sessão, Pix simulado, remarcação e concorrência (e2e)', () => {
  let ctx: TestContext;
  let owner: string;
  let corte: { id: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await login(ctx, DEMO_OWNER_EMAIL);
    corte = (await ctx.http().get('/services').expect(200)).body.find((s: { name: string }) => s.name === 'Corte');
  });

  afterAll(async () => {
    delete process.env.ALLOW_SIMULATIONS;
    await ctx.app.close();
  });

  async function book(name: string, phone: string, professionalId = 'any') {
    const slot = await findFreeSlot(ctx, corte.id, professionalId);
    const res = await ctx
      .http()
      .post('/appointments')
      .send({ serviceId: corte.id, professionalId, startsAt: slot.start, customer: { name, whatsapp: phone } })
      .expect(201);
    const { id } = await ctx.prisma.appointment.findUniqueOrThrow({ where: { manageToken: res.body.manageToken }, select: { id: true } });
    return { ...(res.body as { status: string; manageToken: string; startsAt: string; professional: { id: string } }), id };
  }

  describe('sessão', () => {
    it('token assinado para outro fim (state do Google) não vale como sessão', async () => {
      const ownerUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: DEMO_OWNER_EMAIL } });
      const jwt = ctx.app.get(JwtService);
      const state = await jwt.signAsync({ sub: ownerUser.id, businessId: ownerUser.businessId, role: 'OWNER' }, { audience: 'agendai:google-state' });
      await ctx.http().get('/auth/me').set('Cookie', `agendai_session=${state}`).expect(401);
      const noAudience = await jwt.signAsync({ sub: ownerUser.id, businessId: ownerUser.businessId, role: 'OWNER' });
      await ctx.http().get('/auth/me').set('Cookie', `agendai_session=${noAudience}`).expect(401);
    });

    it('troca de papel e remoção do usuário valem na hora (sem esperar o JWT expirar)', async () => {
      const barber = await login(ctx, DEMO_BARBER_EMAIL);
      await ctx.http().get('/admin/customers').set('Cookie', barber).expect(403);
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: DEMO_BARBER_EMAIL } });

      await ctx.prisma.user.update({ where: { id: user.id }, data: { role: 'OWNER' } });
      await ctx.http().get('/admin/customers').set('Cookie', barber).expect(200);
      await ctx.prisma.user.update({ where: { id: user.id }, data: { role: 'PROFESSIONAL' } });
      await ctx.http().get('/admin/customers').set('Cookie', barber).expect(403);

      await ctx.prisma.user.delete({ where: { id: user.id } });
      await ctx.http().get('/auth/me').set('Cookie', barber).expect(401);
      await ctx.prisma.user.create({ data: user });
    });

    it('PROFESSIONAL não vê e-mails nem comissão dos colegas', async () => {
      const barber = await login(ctx, DEMO_BARBER_EMAIL);
      const me = (await ctx.http().get('/auth/me').set('Cookie', barber).expect(200)).body as { professionalId: string };
      const list = (await ctx.http().get('/admin/professionals').set('Cookie', barber).expect(200)).body as Array<{
        id: string;
        userEmail: string | null;
        commissionPercent: number;
      }>;
      const own = list.find((p) => p.id === me.professionalId)!;
      expect(own.userEmail).toBe(DEMO_BARBER_EMAIL);
      for (const p of list.filter((p) => p.id !== me.professionalId)) {
        expect(p.userEmail).toBeNull();
        expect(p.commissionPercent).toBe(0);
      }
      const asOwner = (await ctx.http().get('/admin/professionals').set('Cookie', owner).expect(200)).body as Array<{ userEmail: string | null }>;
      expect(asOwner.some((p) => p.userEmail === DEMO_BARBER_EMAIL)).toBe(true);
    });

    it('agenda recusa intervalos invertidos ou longos demais', async () => {
      await ctx.http().get('/admin/appointments').query({ from: '2026-01-01', to: '2027-12-31' }).set('Cookie', owner).expect(400);
      await ctx.http().get('/admin/appointments').query({ from: '2026-02-10', to: '2026-02-01' }).set('Cookie', owner).expect(400);
    });
  });

  describe('Pix simulado fora da demonstração', () => {
    it('negócio real sem token do Mercado Pago não ativa Pix nem "paga" simulado', async () => {
      const signup = await ctx
        .http()
        .post('/auth/signup')
        .send({
          businessName: 'Salão Real',
          slug: 'salao-real',
          segment: 'salao',
          ownerName: 'Bia Dona',
          email: 'bia@salao.example',
          password: 'senha-forte-123',
          whatsapp: '(11) 97777-1111',
          city: 'São Paulo',
          state: 'sp',
          addressLine: 'Rua B, 20',
        })
        .expect(201);
      const cookie = signup.get('Set-Cookie')!.find((c) => c.startsWith('agendai_session='))!.split(';')[0]!;

      process.env.ALLOW_SIMULATIONS = 'false';
      try {
        const res = await ctx.http().patch('/admin/business').set('Cookie', cookie).send({ paymentMode: 'DEPOSIT', depositPercent: 30 });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('Mercado Pago');

        // Mesmo forçando no banco, o agendamento online não fica preso a um Pix simulado
        await ctx.prisma.business.update({ where: { slug: 'salao-real' }, data: { paymentMode: 'DEPOSIT' } });
        const service = (await ctx.http().get('/services').set('x-business-slug', 'salao-real').expect(200)).body[0] as { id: string };
        let slot: { start: string } | undefined;
        for (let i = 1; i <= 20 && !slot; i++) {
          const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + i * 86_400_000));
          const r = await ctx.http().get('/availability').set('x-business-slug', 'salao-real').query({ serviceId: service.id, professionalId: 'any', date });
          slot = r.body.slots?.[0];
        }
        const booked = await ctx
          .http()
          .post('/appointments')
          .set('x-business-slug', 'salao-real')
          .send({ serviceId: service.id, professionalId: 'any', startsAt: slot!.start, customer: { name: 'Cliente Real', whatsapp: '(11) 97777-2222' } })
          .expect(201);
        expect(booked.body.status).toBe('SCHEDULED');
        expect(booked.body.payment).toBeNull();

        // A demonstração continua simulando
        const demo = await ctx.prisma.business.findUniqueOrThrow({ where: { slug: DEMO_SLUG } });
        expect(ctx.app.get(PaymentsService).canSimulate(demo)).toBe(true);
      } finally {
        delete process.env.ALLOW_SIMULATIONS;
      }
    });
  });

  describe('remarcação pelo link', () => {
    it('disponibilidade pelo token ignora o tenant, inclui o horário atual e mantém CONFIRMED', async () => {
      const a = await book('Remarca Confirmado', '(19) 95555-1111');
      await ctx.http().patch(`/admin/appointments/${a.id}/status`).set('Cookie', owner).send({ status: 'CONFIRMED' }).expect(200);

      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(a.startsAt));
      // Header de outro negócio (como no subdomínio errado) não interfere
      const slots = await ctx.http().get(`/appointments/manage/${a.manageToken}/availability`).set('x-business-slug', 'salao-real').query({ date }).expect(200);
      const starts = (slots.body.slots as Array<{ start: string; professionalIds: string[] }>).map((s) => s.start);
      expect(starts).toContain(a.startsAt);
      expect(slots.body.slots.every((s: { professionalIds: string[] }) => s.professionalIds.includes(a.professional.id))).toBe(true);

      const days = await ctx.http().get(`/appointments/manage/${a.manageToken}/availability/days`).query({ from: date, to: date }).expect(200);
      expect(days.body.days).toEqual([date]);

      const other = starts.find((s) => s !== a.startsAt)!;
      const moved = await ctx.http().post(`/appointments/manage/${a.manageToken}/reschedule`).send({ startsAt: other }).expect(201);
      expect(moved.body.status).toBe('CONFIRMED');
      expect(moved.body.startsAt).toBe(other);
      expect(moved.body.business.maxAdvanceDays).toBeGreaterThan(0);

      await ctx.http().get('/appointments/manage/token-que-nao-existe/availability').query({ date }).expect(404);
    });
  });

  describe('concorrência', () => {
    it('Pix pago enquanto expira: o pagamento nunca é perdido', async () => {
      await ctx.http().patch('/admin/business').set('Cookie', owner).send({ paymentMode: 'DEPOSIT', depositPercent: 30 }).expect(200);
      const payments = ctx.app.get(PaymentsService);
      try {
        for (let i = 0; i < 3; i++) {
          const a = await book(`Corrida ${i}`, `(19) 9444${i}-0000`);
          expect(a.status).toBe('PENDING_PAYMENT');
          const payment = await ctx.prisma.payment.update({ where: { appointmentId: a.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
          await Promise.all([payments.markPaid(payment), payments.expireStale()]);
          const after = await ctx.prisma.appointment.findUniqueOrThrow({ where: { id: a.id }, include: { payment: true } });
          expect(after.payment!.status).toBe('PAID');
          expect(['CONFIRMED', 'CANCELED']).toContain(after.status);
        }
        // Pago antes da expiração rodar: continua confirmado
        const a = await book('Pago antes', '(19) 94449-0000');
        const payment = await ctx.prisma.payment.update({ where: { appointmentId: a.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
        await payments.markPaid(payment);
        await payments.expireStale();
        const after = await ctx.prisma.appointment.findUniqueOrThrow({ where: { id: a.id }, include: { payment: true } });
        expect(after.status).toBe('CONFIRMED');
        expect(after.payment!.status).toBe('PAID');
      } finally {
        await ctx.http().patch('/admin/business').set('Cookie', owner).send({ paymentMode: 'NONE' }).expect(200);
      }
    });

    it('lembretes disparados em paralelo saem uma vez só por agendamento', async () => {
      const demo = await ctx.prisma.business.update({ where: { slug: DEMO_SLUG }, data: { remindersEnabled: true, reminderHoursBefore: 72 } });
      await ctx.prisma.appointment.updateMany({ where: { businessId: demo.id }, data: { reminderSentAt: null } });
      const messaging = ctx.app.get(MessagingService);
      const since = new Date();
      const [r1, r2] = await Promise.all([messaging.sendDueReminders(new Date(), demo.id), messaging.sendDueReminders(new Date(), demo.id)]);
      const logs = await ctx.prisma.messageLog.groupBy({
        by: ['appointmentId'],
        where: { businessId: demo.id, kind: 'reminder', createdAt: { gte: since } },
        _count: { _all: true },
      });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every((l) => l._count._all === 1)).toBe(true);
      expect(r1.sent + r2.sent).toBe(logs.length);
    });
  });
});
