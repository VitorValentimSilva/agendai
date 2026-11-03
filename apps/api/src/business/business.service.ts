import { Injectable, NotFoundException } from '@nestjs/common';
import type { Business } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { env } from '../common/env.js';
import type { SlotRules } from '../availability/availability.engine.js';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Negócio servido pelas rotas públicas desta instalação (white-label: 1 por deploy). */
  async getPublicBusiness(): Promise<Business> {
    const bySlug = await this.prisma.business.findUnique({ where: { slug: env.businessSlug } });
    const business = bySlug ?? (await this.prisma.business.findFirst({ orderBy: { createdAt: 'asc' } }));
    if (!business) throw new NotFoundException('Nenhum negócio configurado. Rode o seed da API.');
    return business;
  }

  async getById(id: string): Promise<Business> {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Negócio não encontrado.');
    return business;
  }

  static rulesOf(business: Business, relaxed = false): SlotRules {
    return {
      timezone: business.timezone,
      slotIntervalMinutes: business.slotIntervalMinutes,
      minAdvanceMinutes: relaxed ? 0 : business.minAdvanceMinutes,
      maxAdvanceDays: relaxed ? 365 : business.maxAdvanceDays,
    };
  }

  /** Horário de funcionamento por dia da semana: união dos expedientes dos profissionais ativos. */
  async openingHours(businessId: string): Promise<Array<{ weekday: number; intervals: Array<{ start: number; end: number }> }>> {
    const rows = await this.prisma.workingHours.findMany({
      where: { professional: { businessId, active: true } },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    });
    const result: Array<{ weekday: number; intervals: Array<{ start: number; end: number }> }> = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const merged: Array<{ start: number; end: number }> = [];
      for (const r of rows.filter((x) => x.weekday === weekday)) {
        const last = merged.at(-1);
        if (last && r.startMinute <= last.end) last.end = Math.max(last.end, r.endMinute);
        else merged.push({ start: r.startMinute, end: r.endMinute });
      }
      result.push({ weekday, intervals: merged });
    }
    return result;
  }
}
