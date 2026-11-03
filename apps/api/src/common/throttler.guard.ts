import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * O site acessa a API via proxy (rewrite do Next), então o IP real do cliente
 * chega em X-Forwarded-For. Usamos o primeiro IP da cadeia como chave.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, string | string[] | undefined>;
    const forwarded = headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    return first || (req.ip as string | undefined) || 'unknown';
  }
}
