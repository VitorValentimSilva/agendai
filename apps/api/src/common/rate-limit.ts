import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { env } from './env.js';

/**
 * Rate limit simples em memória (por IP e por rota).
 *
 * Substitui o @nestjs/throttler, que ainda é CommonJS e não carrega junto do
 * Nest 12 (ESM) no runtime serverless da Vercel (ERR_REQUIRE_ESM).
 * Em serverless o contador é por instância — suficiente para conter abusos
 * simples; para algo distribuído, troque o Map por Redis/Upstash.
 */
export interface RateLimitOptions {
  /** Requisições permitidas na janela */
  limit: number;
  /** Tamanho da janela em milissegundos */
  ttlMs: number;
}

export const RATE_LIMIT_KEY = 'agendai:rate-limit';

/** Define o limite da rota (ou do controlador inteiro). */
export const RateLimit = (options: Partial<RateLimitOptions>) => SetMetadata(RATE_LIMIT_KEY, options);

/** Primeiro IP de X-Forwarded-For (o site chama a API via proxy do Next) ou o IP da conexão. */
export function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.ip || 'unknown';
}

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    this.sweep(now);

    const key = `${context.getClass().name}.${context.getHandler().name}:${clientKey(req)}`;
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.ttlMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;

    const remaining = Math.max(0, options.limit - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(options.limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > options.limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        `Muitas tentativas em pouco tempo. Tente de novo em ${retryAfter}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
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
