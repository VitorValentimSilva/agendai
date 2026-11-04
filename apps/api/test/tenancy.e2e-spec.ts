import { createTestApp, findFreeSlot, login, type TestContext } from './helpers.js';

const SIGNUP = {
  businessName: 'Studio Teste',
  slug: 'studio-teste',
  segment: 'estudio',
  ownerName: 'Ana Dona',
  email: 'ana@studio.example',
  password: 'senha-forte-123',
  whatsapp: '(11) 98888-1111',
  city: 'São Paulo',
  state: 'sp',
  addressLine: 'Rua A, 10',
};

describe('Multiempresa, cadastro self-service e segurança (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('valida o slug: formato, reservado e disponível', async () => {
    const bad = await ctx.http().get('/auth/slug-available').query({ slug: 'Com Espaço' }).expect(200);
    expect(bad.body.available).toBe(false);
    const reserved = await ctx.http().get('/auth/slug-available').query({ slug: 'admin' }).expect(200);
    expect(reserved.body).toMatchObject({ available: false, reason: expect.stringContaining('reservado') });
    const taken = await ctx.http().get('/auth/slug-available').query({ slug: 'navalha-de-ouro' }).expect(200);
    expect(taken.body.available).toBe(false);
    const free = await ctx.http().get('/auth/slug-available').query({ slug: 'studio-teste' }).expect(200);
    expect(free.body.available).toBe(true);
  });

  it('cadastro cria negócio, dono (logado), profissional e serviços do segmento', async () => {
    await ctx.http().post('/auth/signup').send({ ...SIGNUP, password: '123' }).expect(400);

    const res = await ctx.http().post('/auth/signup').send(SIGNUP).expect(201);
    expect(res.body).toMatchObject({ role: 'OWNER', businessSlug: 'studio-teste', businessName: 'Studio Teste' });
    const cookie = res.get('Set-Cookie')?.find((c) => c.startsWith('agendai_session='))?.split(';')[0];
    expect(cookie).toBeDefined();

    const me = await ctx.http().get('/auth/me').set('Cookie', cookie!).expect(200);
    expect(me.body.businessTimezone).toBe('America/Sao_Paulo');

    // O painel do novo negócio só enxerga os próprios dados
    const services = await ctx.http().get('/admin/services').set('Cookie', cookie!).expect(200);
    expect(services.body.map((s: { name: string }) => s.name)).toEqual(['Sessão', 'Avaliação']);
    const pros = await ctx.http().get('/admin/professionals').set('Cookie', cookie!).expect(200);
    expect(pros.body).toHaveLength(1);
    expect(pros.body[0].name).toBe('Ana Dona');

    // Slug e e-mail não podem ser reutilizados
    await ctx.http().post('/auth/signup').send(SIGNUP).expect(409);
    await ctx.http().post('/auth/signup').send({ ...SIGNUP, slug: 'outro-slug' }).expect(409);
    await ctx.http().post('/auth/signup').send({ ...SIGNUP, slug: 'api', email: 'x@y.example' }).expect(409);
  });

  it('rotas públicas atendem o negócio do header x-business-slug', async () => {
    const studio = await ctx.http().get('/business').set('x-business-slug', 'studio-teste').expect(200);
    expect(studio.body.name).toBe('Studio Teste');
    const fallback = await ctx.http().get('/business').expect(200);
    expect(fallback.body.name).toBe('Barbearia Navalha de Ouro');
    await ctx.http().get('/business').set('x-business-slug', 'nao-existe').expect(404);
    // Slug malformado é ignorado (cai no padrão), nunca vai para a consulta
    await ctx.http().get('/business').set('x-business-slug', "'; drop table--").expect(200);

    const services = await ctx.http().get('/services').set('x-business-slug', 'studio-teste').expect(200);
    expect(services.body.map((s: { name: string }) => s.name)).toEqual(['Sessão', 'Avaliação']);
  });

  it('não permite agendar serviço de outro negócio', async () => {
    const services = await ctx.http().get('/services').expect(200);
    const barberServiceId: string = services.body[0].id;
    const slot = await findFreeSlot(ctx, barberServiceId, 'any');
    await ctx
      .http()
      .post('/appointments')
      .set('x-business-slug', 'studio-teste')
      .send({ serviceId: barberServiceId, professionalId: 'any', startsAt: slot.start, customer: { name: 'Xavier', whatsapp: '11999990000' } })
      .expect(404);
  });

  it('agendamento online não sobrescreve nome de cliente existente', async () => {
    const existing = await ctx.prisma.customer.findFirstOrThrow({ where: { business: { slug: 'navalha-de-ouro' } } });
    const services = await ctx.http().get('/services').expect(200);
    const serviceId: string = services.body[0].id;
    const slot = await findFreeSlot(ctx, serviceId, 'any');
    await ctx
      .http()
      .post('/appointments')
      .send({ serviceId, professionalId: 'any', startsAt: slot.start, customer: { name: 'Nome Forjado', whatsapp: existing.whatsapp } })
      .expect(201);
    const after = await ctx.prisma.customer.findUniqueOrThrow({ where: { id: existing.id } });
    expect(after.name).toBe(existing.name);
  });

  it('bloqueia mudança com cookie vinda de origem desconhecida (CSRF) e envia headers de segurança', async () => {
    const cookie = await login(ctx, 'demo@agendai.app');
    await ctx
      .http()
      .patch('/admin/business')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({ name: 'Hackeado' })
      .expect(403);
    await ctx
      .http()
      .patch('/admin/business')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ description: 'Ok' })
      .expect(200);

    const res = await ctx.http().get('/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
  });
});
