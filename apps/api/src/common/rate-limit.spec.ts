import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard, RATE_LIMIT_KEY } from './rate-limit.js';

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

  it('permite até o limite e responde 429 em pt-BR depois', () => {
    const guard = new RateLimitGuard(reflector);
    const { ctx, resHeaders } = contextFor(create, '1.1.1.1');
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    try {
      guard.canActivate(ctx);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).message).toMatch(/Muitas tentativas/);
    }
    expect(resHeaders['Retry-After']).toBeDefined();
  });

  it('conta separadamente por IP (usa o primeiro IP de X-Forwarded-For)', () => {
    const guard = new RateLimitGuard(reflector);
    const a = contextFor(create, '10.0.0.1', { 'x-forwarded-for': '200.1.1.1, 10.0.0.1' });
    const b = contextFor(create, '10.0.0.1', { 'x-forwarded-for': '200.2.2.2, 10.0.0.1' });
    guard.canActivate(a.ctx);
    guard.canActivate(a.ctx);
    expect(() => guard.canActivate(a.ctx)).toThrow(HttpException);
    expect(guard.canActivate(b.ctx)).toBe(true);
  });

  it('conta separadamente por rota e libera após a janela', () => {
    vi.useFakeTimers();
    const guard = new RateLimitGuard(reflector);
    const c = contextFor(create, '3.3.3.3');
    guard.canActivate(c.ctx);
    guard.canActivate(c.ctx);
    expect(() => guard.canActivate(c.ctx)).toThrow(HttpException);
    // Outra rota usa o limite padrão (env), independente
    expect(guard.canActivate(contextFor(list, '3.3.3.3').ctx)).toBe(true);
    vi.advanceTimersByTime(60_001);
    expect(guard.canActivate(c.ctx)).toBe(true);
  });
});
