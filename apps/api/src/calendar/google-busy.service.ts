import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Professional } from '@prisma/client';
import { decryptSecret } from '../common/crypto.js';
import { AvailabilityService, type ExternalBusyProvider } from '../availability/availability.service.js';
import type { TimeRange } from '../availability/availability.engine.js';
import { GoogleClient } from './google.client.js';
import { busyFromGoogleEvents } from './google-busy.js';

const CACHE_MS = 2 * 60_000;

/**
 * Horários ocupados na agenda pessoal do Google de cada profissional conectado.
 * Se registra no AvailabilityService: compromissos pessoais passam a bloquear horários no site.
 * Falha do Google nunca derruba a agenda: ignora e registra no log.
 */
@Injectable()
export class GoogleBusyService implements ExternalBusyProvider, OnModuleInit {
  private readonly logger = new Logger(GoogleBusyService.name);
  private readonly cache = new Map<string, { at: number; busy: TimeRange[] }>();

  constructor(
    private readonly google: GoogleClient,
    private readonly availability: AvailabilityService,
  ) {}

  onModuleInit(): void {
    this.availability.setExternalBusyProvider(this);
  }

  async busyFor(
    professionals: Array<Pick<Professional, 'id' | 'googleRefreshTokenEnc' | 'googleCalendarId'>>,
    range: TimeRange,
    timezone: string,
  ): Promise<Map<string, TimeRange[]>> {
    const result = new Map<string, TimeRange[]>();
    if (!this.google.enabled) return result;
    const connected = professionals.filter((p) => p.googleRefreshTokenEnc);
    await Promise.all(
      connected.map(async (p) => {
        const key = `${p.id}:${range.start.getTime()}:${range.end.getTime()}`;
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.at < CACHE_MS) {
          result.set(p.id, cached.busy);
          return;
        }
        try {
          const token = await this.google.accessToken(decryptSecret(p.googleRefreshTokenEnc!));
          const events = await this.google.listEvents(token, p.googleCalendarId ?? 'primary', range.start, range.end);
          const busy = busyFromGoogleEvents(events, timezone);
          this.sweep();
          this.cache.set(key, { at: Date.now(), busy });
          result.set(p.id, busy);
        } catch (error) {
          this.logger.warn(`Google indisponível para o profissional ${p.id}: ${(error as Error).message}`);
        }
      }),
    );
    return result;
  }

  /** Limpa o cache quando o profissional conecta/desconecta ou um evento é criado pelo Agendaí. */
  forget(professionalId: string): void {
    for (const key of this.cache.keys()) if (key.startsWith(`${professionalId}:`)) this.cache.delete(key);
  }

  private sweep(): void {
    if (this.cache.size < 500) return;
    const now = Date.now();
    for (const [key, v] of this.cache) if (now - v.at >= CACHE_MS) this.cache.delete(key);
  }
}
