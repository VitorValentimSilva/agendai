import { createTestApp, login, type TestContext } from './helpers.js';
import { MercadoPagoClient } from '../src/payments/mercadopago.client.js';
import { decryptSecret } from '../src/common/crypto.js';

/** Mercado Pago falso: OAuth + criação de order. */
const fakeMp = {
  exchanged: [] as string[],
  refreshed: [] as string[],
  created: [] as Array<{ accessToken: string }>,
  oauthRedirectUri: 'http://localhost:3001/integrations/mercadopago/callback',
  oauthUrl: (state: string) => `https://auth.mercadopago.com/authorization?client_id=app&state=${encodeURIComponent(state)}`,
  async exchangeCode(code: string) {
    fakeMp.exchanged.push(code);
    return { accessToken: 'oauth-access-1', refreshToken: 'oauth-refresh-1', expiresAt: new Date(Date.now() + 180 * 86_400_000), userId: '777' };
  },
  async refreshToken(refresh: string) {
    fakeMp.refreshed.push(refresh);
    return { accessToken: 'oauth-access-2', refreshToken: 'oauth-refresh-2', expiresAt: new Date(Date.now() + 180 * 86_400_000), userId: '777' };
  },
  async createPix(input: { accessToken: string }) {
    fakeMp.created.push(input);
    return { providerPaymentId: `ORD01OAUTH${fakeMp.created.length}`, qrCode: '000201-PIX', qrCodeBase64: null, ticketUrl: null };
  },
  async cancel() {},
  simulatedPix: (amountCents: number, reference: string) => new MercadoPagoClient().simulatedPix(amountCents, reference),
};

describe('Conectar Mercado Pago (OAuth) (e2e)', () => {
  let ctx: TestContext;
  let owner: string;
  let serviceId: string;
  const slug = 'salao-oauth';

  async function freeSlot(): Promise<string> {
    for (let i = 1; i <= 20; i++) {
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + i * 86_400_000));
      const r = await ctx.http().get('/availability').set('x-business-slug', slug).query({ serviceId, professionalId: 'any', date });
      const slots = r.body.slots as Array<{ start: string }> | undefined;
      if (slots?.length) return slots[Math.floor(Math.random() * slots.length)]!.start;
    }
    throw new Error('sem horário');
  }

  async function book(name: string, phone: string) {
    return ctx
      .http()
      .post('/appointments')
      .set('x-business-slug', slug)
      .send({ serviceId, professionalId: 'any', startsAt: await freeSlot(), customer: { name, whatsapp: phone } })
      .expect(201);
  }

  beforeAll(async () => {
    ctx = await createTestApp((b) => b.overrideProvider(MercadoPagoClient).useValue(fakeMp));
    const signup = await ctx
      .http()
      .post('/auth/signup')
      .send({
        businessName: 'Salão OAuth',
        slug,
        segment: 'salao',
        ownerName: 'Olga Dona',
        email: 'olga@salao.example',
        password: 'senha-forte-123',
        whatsapp: '(11) 97777-3333',
        city: 'São Paulo',
        state: 'sp',
        addressLine: 'Rua C, 30',
      })
      .expect(201);
    owner = signup.get('Set-Cookie')!.find((c) => c.startsWith('agendai_session='))!.split(';')[0]!;
    serviceId = (await ctx.http().get('/services').set('x-business-slug', slug).expect(200)).body[0].id;
  });

  afterAll(async () => {
    delete process.env.MP_CLIENT_ID;
    delete process.env.MP_CLIENT_SECRET;
    delete process.env.ALLOW_SIMULATIONS;
    await ctx.app.close();
  });

  it('sem MP_CLIENT_ID/SECRET o botão fica indisponível (503) e as integrações avisam', async () => {
    await ctx.http().get('/admin/integrations/mercadopago/connect').set('Cookie', owner).expect(503);
    const integrations = await ctx.http().get('/admin/integrations').set('Cookie', owner).expect(200);
    expect(integrations.body.mercadoPagoOAuth).toBe(false);
  });

  it('conecta pelo OAuth, guarda tokens cifrados e nunca os devolve', async () => {
    process.env.MP_CLIENT_ID = 'app-id';
    process.env.MP_CLIENT_SECRET = 'app-secret';
    process.env.ALLOW_SIMULATIONS = 'false';
    expect((await ctx.http().get('/admin/integrations').set('Cookie', owner).expect(200)).body.mercadoPagoOAuth).toBe(true);

    // Só o dono conecta
    const barber = await login(ctx, 'barbeiro@agendai.app');
    await ctx.http().get('/admin/integrations/mercadopago/connect').set('Cookie', barber).expect(403);

    const connect = await ctx.http().get('/admin/integrations/mercadopago/connect').set('Cookie', owner).expect(200);
    const state = new URL(connect.body.url).searchParams.get('state')!;

    await ctx.http().get('/integrations/mercadopago/callback').query({ code: 'c', state: 'adulterado' }).expect(302).expect('location', /mercadopago=erro/);
    await ctx.http().get('/integrations/mercadopago/callback').query({ error: 'access_denied', state }).expect(302).expect('location', /mercadopago=erro/);
    await ctx.http().get('/integrations/mercadopago/callback').query({ code: 'code-ok', state }).expect(302).expect('location', /mercadopago=ok/);
    expect(fakeMp.exchanged).toEqual(['code-ok']);

    const settings = await ctx.http().get('/admin/business').set('Cookie', owner).expect(200);
    expect(settings.body.mercadoPago).toMatchObject({ connected: true, via: 'OAUTH', userId: '777' });
    expect(JSON.stringify(settings.body)).not.toMatch(/oauth-access|oauth-refresh|TokenEnc/);
    const stored = await ctx.prisma.business.findUniqueOrThrow({ where: { slug } });
    expect(decryptSecret(stored.mercadoPagoRefreshTokenEnc!)).toBe('oauth-refresh-1');
    expect(stored.mercadoPagoTokenEnc).not.toContain('oauth-access-1');
  });

  it('Pix usa o token da conta conectada e renova sozinho perto de vencer', async () => {
    await ctx.http().patch('/admin/business').set('Cookie', owner).send({ paymentMode: 'FULL' }).expect(200);

    const first = await book('Cliente OAuth', '(11) 97777-4444');
    expect(first.body.status).toBe('PENDING_PAYMENT');
    expect(fakeMp.created.at(-1)!.accessToken).toBe('oauth-access-1');
    expect(fakeMp.refreshed).toEqual([]);

    // Faltando 1 dia para vencer → renova antes de criar a order e guarda o novo par
    await ctx.prisma.business.update({ where: { slug }, data: { mercadoPagoTokenExpiresAt: new Date(Date.now() + 86_400_000) } });
    await book('Cliente Renova', '(11) 97777-5555');
    expect(fakeMp.refreshed).toEqual(['oauth-refresh-1']);
    expect(fakeMp.created.at(-1)!.accessToken).toBe('oauth-access-2');
    const stored = await ctx.prisma.business.findUniqueOrThrow({ where: { slug } });
    expect(decryptSecret(stored.mercadoPagoRefreshTokenEnc!)).toBe('oauth-refresh-2');
    expect(stored.mercadoPagoTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 170 * 86_400_000);
  });

  it('desconectar limpa os tokens e desliga a cobrança Pix', async () => {
    const res = await ctx.http().delete('/admin/integrations/mercadopago').set('Cookie', owner).expect(200);
    expect(res.body).toMatchObject({ paymentMode: 'NONE', mercadoPago: { connected: false, via: null } });
    const stored = await ctx.prisma.business.findUniqueOrThrow({ where: { slug } });
    expect(stored.mercadoPagoTokenEnc).toBeNull();
    expect(stored.mercadoPagoRefreshTokenEnc).toBeNull();
    // Sem conta e fora da demo, não dá para religar o Pix
    await ctx.http().patch('/admin/business').set('Cookie', owner).send({ paymentMode: 'DEPOSIT' }).expect(400);
  });
});
