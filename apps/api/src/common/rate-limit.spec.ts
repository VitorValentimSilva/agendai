import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard, RATE_LIMIT_KEY, UpstashRateLimitStore, type RateLimitStore } from './rate-limit.js';

class FakeController {}
const create = () => undefined;
const list = () => undefined;

function contextFor(handler: () => void, ip: string, headers: Record<string, string> = {}) {
  const resHeaders: Record<string, string> = {};
  const ctx = {
    getHandler: () => handler,
    getClass: () => FakeController,
    switchToHttp: () => ({
      getRequest: () => ({ ip, headers }),
      getResponse: () => ({ setHeader: (k: string, v: string) => (resHeaders[k] = v) }),
    }),
  } as unknown as ExecutionContext;
  return { ctx, resHeaders };
}

describe('RateLimitGuard', () => {
  const reflector = new Reflector();
  Reflect.defineMetadata(RATE_LIMIT_KEY, { limit: 2, ttlMs: 60_000 }, create);

  afterEach(() => vi.useRealTimers());

  it('permite até o limite e responde 429 em pt-BR depois', async () => {
    const guard = new RateLimitGuard(reflector, null);
    const { ctx, resHeaders } = contextFor(create, '1.1.1.1');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    try {
      await guard.canActivate(ctx);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).message).toMatch(/Muitas tentativas/);
    }
    expect(resHeaders['Retry-After']).toBeDefined();
  });

  it('conta separadamente por IP (usa o primeiro IP de X-Forwarded-For)', async () => {
    const guard = new RateLimitGuard(reflector, null);
    const a = contextFor(create, '10.0.0.1', { 'x-forwarded-for': '200.1.1.1, 10.0.0.1' });
    const b = contextFor(create, '10.0.0.1', { 'x-forwarded-for': '200.2.2.2, 10.0.0.1' });
    await guard.canActivate(a.ctx);
    await guard.canActivate(a.ctx);
    await expect(guard.canActivate(a.ctx)).rejects.toThrow(HttpException);
    await expect(guard.canActivate(b.ctx)).resolves.toBe(true);
  });

  it('conta separadamente por rota e libera após a janela', async () => {
    vi.useFakeTimers();
    const guard = new RateLimitGuard(reflector, null);
    const c = contextFor(create, '3.3.3.3');
    await guard.canActivate(c.ctx);
    await guard.canActivate(c.ctx);
    await expect(guard.canActivate(c.ctx)).rejects.toThrow(HttpException);
    // Outra rota usa o limite padrão (env), independente
    await expect(guard.canActivate(contextFor(list, '3.3.3.3').ctx)).resolves.toBe(true);
    vi.advanceTimersByTime(60_001);
    await expect(guard.canActivate(c.ctx)).resolves.toBe(true);
  });

  it('usa o store distribuído quando configurado (contador compartilhado entre instâncias)', async () => {
    const shared = new Map<string, number>();
    const store: RateLimitStore = {
      hit: (key, ttlMs, now) => {
        const count = (shared.get(key) ?? 0) + 1;
        shared.set(key, count);
        return Promise.resolve({ count, resetAt: now + ttlMs });
      },
    };
    const instanceA = new RateLimitGuard(reflector, store);
    const instanceB = new RateLimitGuard(reflector, store);
    const c = contextFor(create, '4.4.4.4');
    await instanceA.canActivate(c.ctx);
    await instanceB.canActivate(c.ctx);
    await expect(instanceA.canActivate(c.ctx)).rejects.toThrow(HttpException);
  });

  it('se o Redis falhar, cai para a memória sem derrubar a requisição', async () => {
    const broken: RateLimitStore = { hit: () => Promise.reject(new Error('timeout')) };
    const guard = new RateLimitGuard(reflector, broken);
    const c = contextFor(create, '5.5.5.5');
    await expect(guard.canActivate(c.ctx)).resolves.toBe(true);
    await expect(guard.canActivate(c.ctx)).resolves.toBe(true);
    await expect(guard.canActivate(c.ctx)).rejects.toThrow(HttpException);
  });
});

describe('UpstashRateLimitStore', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envia INCR + PEXPIRE NX + PTTL em um pipeline e lê o contador', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ result: 3 }, { result: 0 }, { result: 42_000 }]),
    });
    vi.stubGlobal('fetch', fetchMock);
    const store = new UpstashRateLimitStore('https://x.upstash.io/', 'tok');
    const hit = await store.hit('k', 60_000, 1_000);
    expect(hit).toEqual({ count: 3, resetAt: 43_000 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://x.upstash.io/pipeline');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual([
      ['INCR', 'agendai:rl:k'],
      ['PEXPIRE', 'agendai:rl:k', '60000', 'NX'],
      ['PTTL', 'agendai:rl:k'],
    ]);
  });

  it('erro HTTP vira exceção (o guard faz o fallback)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(new UpstashRateLimitStore('https://x', 't').hit('k', 1000, 0)).rejects.toThrow(/401/);
  });
});
