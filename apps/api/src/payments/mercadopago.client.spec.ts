import { MercadoPagoClient } from './mercadopago.client.js';

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('MercadoPagoClient (Orders API)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const client = new MercadoPagoClient();

  it('cria uma order Pix automática e lê o QR em transactions.payments[0].payment_method', async () => {
    const fetchMock = mockFetch({
      id: 'ORD01ABC',
      status: 'action_required',
      transactions: { payments: [{ payment_method: { id: 'pix', qr_code: '000201PIX', qr_code_base64: 'iVBOR', ticket_url: 'https://mp/t' } }] },
    });
    const charge = await client.createPix({
      accessToken: 'APP_USR-x',
      amountCents: 1650,
      payerEmail: 'a@b.example',
      payerFirstName: 'Ana',
      externalReference: 'appt-1',
      expirationMinutes: 10,
      idempotencyKey: 'appt-1',
    });
    expect(charge).toEqual({ providerPaymentId: 'ORD01ABC', qrCode: '000201PIX', qrCodeBase64: 'iVBOR', ticketUrl: 'https://mp/t' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.mercadopago.com/v1/orders');
    expect(init.headers['X-Idempotency-Key']).toBe('appt-1');
    expect(JSON.parse(init.body)).toEqual({
      type: 'online',
      processing_mode: 'automatic',
      total_amount: '16.50',
      external_reference: 'appt-1',
      payer: { email: 'a@b.example', first_name: 'Ana' },
      // O Mercado Pago exige no mínimo 30 minutos de validade para Pix
      transactions: { payments: [{ amount: '16.50', payment_method: { id: 'pix', type: 'bank_transfer' }, expiration_time: 'PT30M' }] },
    });
  });

  it('erro da API vira exceção com a mensagem do Mercado Pago', async () => {
    mockFetch({ errors: [{ message: 'invalid payer email' }] }, false, 400);
    await expect(
      client.createPix({ accessToken: 't', amountCents: 100, payerEmail: 'x', payerFirstName: 'x', externalReference: 'r', expirationMinutes: 60, idempotencyKey: 'k' }),
    ).rejects.toThrow(/invalid payer email/);
  });

  it('consulta a order, estorna e cancela pelos endpoints de Orders', async () => {
    const fetchMock = mockFetch({ status: 'processed', status_detail: 'accredited', external_reference: 'appt-1' });
    await expect(client.getStatus('t', 'ORD01ABC')).resolves.toEqual({ status: 'processed', statusDetail: 'accredited', externalReference: 'appt-1' });
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.mercadopago.com/v1/orders/ORD01ABC');

    await client.refund('t', 'ORD01ABC', 'refund-1');
    expect(fetchMock.mock.calls[1]![0]).toBe('https://api.mercadopago.com/v1/orders/ORD01ABC/refund');
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ method: 'POST', headers: { 'X-Idempotency-Key': 'refund-1' } });
    expect(fetchMock.mock.calls[1]![1].body).toBeUndefined(); // reembolso total: body vazio

    await client.cancel('t', 'ORD01ABC', 'cancel-1');
    expect(fetchMock.mock.calls[2]![0]).toBe('https://api.mercadopago.com/v1/orders/ORD01ABC/cancel');
  });
});

describe('MercadoPagoClient (OAuth)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MP_CLIENT_ID;
    delete process.env.MP_CLIENT_SECRET;
  });

  it('monta a URL de autorização com state e redirect da API', () => {
    process.env.MP_CLIENT_ID = 'app-123';
    const url = new URL(new MercadoPagoClient().oauthUrl('st-1'));
    expect(url.origin + url.pathname).toBe('https://auth.mercadopago.com/authorization');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'app-123',
      response_type: 'code',
      platform_id: 'mp',
      state: 'st-1',
      redirect_uri: expect.stringMatching(/\/integrations\/mercadopago\/callback$/),
    });
  });

  it('troca o code e renova pelo /oauth/token com as credenciais da aplicação', async () => {
    process.env.MP_CLIENT_ID = 'app-123';
    process.env.MP_CLIENT_SECRET = 'sec';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ access_token: 'APP_USR-a', refresh_token: 'TG-r', expires_in: 15552000, user_id: 42 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new MercadoPagoClient();
    const tokens = await client.exchangeCode('code-1');
    expect(tokens).toMatchObject({ accessToken: 'APP_USR-a', refreshToken: 'TG-r', userId: '42' });
    expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now() + 179 * 86_400_000);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.mercadopago.com/oauth/token');
    expect(JSON.parse(init.body)).toMatchObject({ client_id: 'app-123', client_secret: 'sec', grant_type: 'authorization_code', code: 'code-1' });

    await client.refreshToken('TG-r');
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'TG-r' });
  });

  it('erro do OAuth vira exceção', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ message: 'invalid_grant' }) }));
    await expect(new MercadoPagoClient().exchangeCode('x')).rejects.toThrow(/invalid_grant/);
  });
});
