import { createHmac } from 'node:crypto';
import { createTestApp, findFreeSlot, login, type TestContext } from './helpers.js';
import { MercadoPagoClient } from '../src/payments/mercadopago.client.js';
import { encryptSecret } from '../src/common/crypto.js';

/** Mercado Pago falso: cria cobranças e responde o status que o teste definir. */
const fakeMp = {
  statuses: new Map<string, { status: string; externalReference: string }>(),
  created: [] as Array<{ accessToken: string; amountCents: number; externalReference: string }>,
  async createPix(input: { accessToken: string; amountCents: number; externalReference: string }) {
    const id = `mp_${fakeMp.created.length + 1}`;
    fakeMp.created.push(input);
    fakeMp.statuses.set(id, { status: 'pending', externalReference: input.externalReference });
    return { providerPaymentId: id, qrCode: '000201-PIX-REAL', qrCodeBase64: 'iVBORw0KGgo=', ticketUrl: 'https://mp/ticket' };
  },
  async getStatus(_token: string, id: string) {
    const s = fakeMp.statuses.get(id);
    if (!s) throw new Error('not found');
    return s;
  },
  simulatedPix: (amountCents: number, reference: string) => new MercadoPagoClient().simulatedPix(amountCents, reference),
};

function mpSignature(dataId: string, requestId: string) {
  const ts = String(Date.now());
  const v1 = createHmac('sha256', 'e2e-mp-webhook-secret').update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('Pix (e2e)', () => {
  let ctx: TestContext;
  let owner: string;
  let service: { id: string; priceCents: number };

  async function book(name: string, phone: string, professionalId = 'any') {
    const slot = await findFreeSlot(ctx, service.id, professionalId);
    const res = await ctx
      .http()
      .post('/appointments')
      .send({ serviceId: service.id, professionalId, startsAt: slot.start, customer: { name, whatsapp: phone } });
    return { res, slot };
  }

  beforeAll(async () => {
    ctx = await createTestApp((b) => b.overrideProvider(MercadoPagoClient).useValue(fakeMp));
    owner = await login(ctx, 'demo@agendai.app');
    service = (await ctx.http().get('/services').expect(200)).body.find((s: { name: string }) => s.name === 'Corte');
    await ctx.http().patch('/admin/business').set('Cookie', owner).send({ paymentMode: 'DEPOSIT', depositPercent: 30 }).expect(200);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('sinal via Pix simulado: segura o horário e confirma ao pagar', async () => {
    const { res, slot } = await book('Pix Sinal', '(19) 96666-1111');
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING_PAYMENT');
    expect(res.body.payment).toMatchObject({ status: 'PENDING', provider: 'SIMULATED', amountCents: Math.ceil(service.priceCents * 0.3) });
    expect(res.body.payment.qrCode).toMatch(/^000201/);

    // O horário fica bloqueado para o mesmo profissional enquanto o Pix está pendente
    const blocked = await ctx
      .http()
      .post('/appointments')
      .send({ serviceId: service.id, professionalId: res.body.professional.id, startsAt: slot.start, customer: { name: 'Outro', whatsapp: '(19) 96666-2222' } });
    expect(blocked.status).toBe(409);

    const paid = await ctx.http().post(`/appointments/manage/${res.body.manageToken}/simulate-payment`).expect(200);
    expect(paid.body.status).toBe('CONFIRMED');
    expect(paid.body.payment).toMatchObject({ status: 'PAID', qrCode: null });
    const stored = await ctx.prisma.appointment.findUniqueOrThrow({ where: { manageToken: res.body.manageToken } });
    expect(stored.confirmedVia).toBe('PIX');

    await ctx.http().post(`/appointments/manage/${res.body.manageToken}/simulate-payment`).expect(400);
  });

  it('Pix expirado cancela o agendamento e libera o horário', async () => {
    const { res, slot } = await book('Pix Expira', '(19) 96666-3333');
    await ctx.prisma.payment.updateMany({
      where: { appointment: { manageToken: res.body.manageToken } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const free = await ctx
      .http()
      .get('/availability')
      .query({ serviceId: service.id, professionalId: res.body.professional.id, date: slot.date })
      .expect(200);
    expect(free.body.slots.map((s: { start: string }) => s.start)).toContain(slot.start);
    const view = await ctx.http().get(`/appointments/manage/${res.body.manageToken}`).expect(200);
    expect(view.body.status).toBe('CANCELED');
    expect(view.body.payment.status).toBe('EXPIRED');
  });

  it('cliente desiste de um Pix pendente: cancela e invalida a cobrança', async () => {
    const { res } = await book('Pix Desiste', '(19) 96666-4444');
    const canceled = await ctx.http().post(`/appointments/manage/${res.body.manageToken}/cancel`).expect(201);
    expect(canceled.body.status).toBe('CANCELED');
    expect(canceled.body.payment.status).toBe('CANCELED');
  });

  it('Mercado Pago real (token do negócio cifrado) + webhook assinado confirma o pagamento', async () => {
    await ctx.prisma.business.update({
      where: { slug: 'navalha-de-ouro' },
      data: { mercadoPagoTokenEnc: encryptSecret('TEST-TOKEN-NEGOCIO'), paymentMode: 'FULL' },
    });
    const { res } = await book('Pix Real', '(19) 96666-5555');
    expect(res.body.payment).toMatchObject({ provider: 'MERCADO_PAGO', amountCents: service.priceCents, qrCodeBase64: 'iVBORw0KGgo=' });
    const created = fakeMp.created.at(-1)!;
    expect(created.accessToken).toBe('TEST-TOKEN-NEGOCIO');
    const providerId = `mp_${fakeMp.created.length}`;

    // Assinatura inválida
    await ctx.http().post('/webhooks/mercadopago').query({ 'data.id': providerId, type: 'payment' }).set('x-signature', 'ts=1,v1=00').set('x-request-id', 'r1').send({}).expect(401);

    // Ainda pendente na API do MP → nada muda
    const pending = await ctx
      .http()
      .post('/webhooks/mercadopago')
      .query({ 'data.id': providerId, type: 'payment' })
      .set('x-signature', mpSignature(providerId, 'r2'))
      .set('x-request-id', 'r2')
      .send({ type: 'payment', data: { id: providerId } })
      .expect(200);
    expect(pending.body.result).toBe('ignored');

    // Aprovado → confirma
    fakeMp.statuses.set(providerId, { status: 'approved', externalReference: created.externalReference });
    const paid = await ctx
      .http()
      .post('/webhooks/mercadopago')
      .query({ 'data.id': providerId, type: 'payment' })
      .set('x-signature', mpSignature(providerId, 'r3'))
      .set('x-request-id', 'r3')
      .send({ type: 'payment', data: { id: providerId } })
      .expect(200);
    expect(paid.body.result).toBe('paid');
    const view = await ctx.http().get(`/appointments/manage/${res.body.manageToken}`).expect(200);
    expect(view.body).toMatchObject({ status: 'CONFIRMED', payment: { status: 'PAID' } });

    // Pix real não pode ser "simulado"
    await ctx.http().post(`/appointments/manage/${res.body.manageToken}/simulate-payment`).expect(400);

    // O token nunca volta nas configurações
    const settings = await ctx.http().get('/admin/business').set('Cookie', owner).expect(200);
    expect(settings.body.hasMercadoPagoToken).toBe(true);
    expect(JSON.stringify(settings.body)).not.toContain('TEST-TOKEN');
  });
});
