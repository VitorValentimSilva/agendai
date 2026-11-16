import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { env } from './env.js';
import { safeEqual } from './crypto.js';

/**
 * Rate limit por IP e por rota. Com UPSTASH_REDIS_REST_URL/TOKEN (ou KV_REST_API_URL/TOKEN, nomes da
 * integração da Vercel) os contadores ficam no Redis e valem para todas as instâncias serverless.
 *
 * Substitui o @nestjs/throttler, que ainda é CommonJS e não carrega junto do
 * Nest 12 (ESM) no runtime serverless da Vercel (ERR_REQUIRE_ESM).
 * Sem Redis (ou se ele falhar), conta em memória — por instância.
 */
export interface RateLimitOptions {
  /** Requisições permitidas na janela */
  limit: number;
  /** Tamanho da janela em milissegundos */
  ttlMs: number;
}

export const RATE_LIMIT_KEY = 'agendai:rate-limit';

/** Token de injeção para trocar o store (testes). */
export const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');

/** Define o limite da rota (ou do controlador inteiro). */
export const RateLimit = (options: Partial<RateLimitOptions>) => SetMetadata(RATE_LIMIT_KEY, options);

export const CLIENT_IP_HEADER = 'x-agendai-client-ip';
export const PROXY_SECRET_HEADER = 'x-agendai-proxy-secret';

/**
 * IP do cliente para o rate limit.
 * O site chama a API pelo proxy do Next: o IP que chega aqui seria o do servidor do site.
 * Por isso o proxy repassa o IP real em `x-agendai-client-ip`, autenticado por PROXY_SECRET
 * (sem o segredo, o header é ignorado — evita que alguém forje outro IP para burlar o limite).
 */
export function clientKey(req: Request): string {
  const secret = env.proxySecret;
  const sent = req.headers[PROXY_SECRET_HEADER];
  if (secret && typeof sent === 'string' && safeEqual(sent, secret)) {
    const ip = req.headers[CLIENT_IP_HEADER];
    const value = (Array.isArray(ip) ? ip[0] : ip)?.trim();
    if (value) return value;
  }
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.ip || 'unknown';
}

export interface Hit {
  count: number;
  resetAt: number;
}

/** Onde os contadores ficam. Em memória é por instância; no Redis vale para todas. */
export interface RateLimitStore {
  hit(key: string, ttlMs: number, now: number): Promise<Hit>;
}

/** Janela fixa em memória (fallback e desenvolvimento). */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Hit>();
  private lastSweep = 0;

  hit(key: string, ttlMs: number, now: number): Promise<Hit> {
    this.sweep(now);
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + ttlMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    return Promise.resolve({ ...bucket });
  }

  /** Remove janelas expiradas de vez em quando para o Map não crescer sem limite. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

/**
 * Janela fixa no Upstash Redis pela API REST (um pipeline: INCR + PEXPIRE NX + PTTL).
 * Sem SDK: só fetch, então não há dependência CommonJS no runtime da Vercel.
 */
export class UpstashRateLimitStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly timeoutMs = 400,
  ) {}

  async hit(key: string, ttlMs: number, now: number): Promise<Hit> {
    const redisKey = `agendai:rl:${key}`;
    const res = await fetch(`${this.url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, String(ttlMs), 'NX'],
        ['PTTL', redisKey],
      ]),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Upstash respondeu ${res.status}`);
    const [incr, , pttl] = (await res.json()) as Array<{ result?: number; error?: string }>;
    if (typeof incr?.result !== 'number') throw new Error(incr?.error ?? 'Resposta inesperada do Upstash');
    const ttl = typeof pttl?.result === 'number' && pttl.result > 0 ? pttl.result : ttlMs;
    return { count: incr.result, resetAt: now + ttl };
  }
}

/** Upstash quando configurado (aceita os nomes da integração UPSTASH_* ou KV_*); senão memória. */
export function defaultRateLimitStore(): RateLimitStore | null {
  return env.upstashRestUrl && env.upstashRestToken ? new UpstashRateLimitStore(env.upstashRestUrl, env.upstashRestToken) : null;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly memory = new MemoryRateLimitStore();
  private readonly remote: RateLimitStore | null;
  private lastRemoteError = 0;

  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject(RATE_LIMIT_STORE) remote?: RateLimitStore | null,
  ) {
    this.remote = remote === undefined ? defaultRateLimitStore() : remote;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options: RateLimitOptions = {
      limit: env.throttleLimit,
      ttlMs: 60_000,
      ...this.reflector.getAllAndOverride<Partial<RateLimitOptions> | undefined>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]),
    };

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const now = Date.now();

    const key = `${context.getClass().name}.${context.getHandler().name}:${clientKey(req)}`;
    const bucket = await this.hit(key, options.ttlMs, now);

    const remaining = Math.max(0, options.limit - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(options.limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > options.limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        `Muitas tentativas em pouco tempo. Tente de novo em ${retryAfter}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /** Usa o Redis; se ele falhar ou demorar, conta em memória para não derrubar a API. */
  private async hit(key: string, ttlMs: number, now: number): Promise<Hit> {
    if (this.remote) {
      try {
        return await this.remote.hit(key, ttlMs, now);
      } catch (error) {
        if (now - this.lastRemoteError > 60_000) {
          this.lastRemoteError = now;
          this.logger.warn(`Rate limit distribuído indisponível, usando memória: ${(error as Error).message}`);
        }
      }
    }
    return this.memory.hit(key, ttlMs, now);
  }
}
