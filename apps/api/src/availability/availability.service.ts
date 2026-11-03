import { Injectable, NotFoundException } from '@nestjs/common';
import type { Business, Service } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { BusinessService } from '../business/business.service.js';
import {
  addCalendarDays,
  computeAnySlots,
  computeProfessionalSlots,
  diffInCalendarDays,
  formatLocalDate,
  localDayRange,
  type AnySlot,
  type LocalDate,
  type ProfessionalSchedule,
  type TimeRange,
} from './availability.engine.js';

export interface AvailabilityQuery {
  business: Business;
  serviceId: string;
  /** id do profissional ou "any" */
  professionalId: string;
  now?: Date;
  /** Painel: ignora antecedência mínima e limite de dias. */
  relaxed?: boolean;
  /** Ao remarcar, o próprio agendamento não conta como ocupado. */
  excludeAppointmentId?: string;
}

interface LoadedContext {
  service: Service;
  professionals: Array<{ id: string; name: string }>;
  schedules: ProfessionalSchedule[];
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async slotsForDate(query: AvailabilityQuery, date: LocalDate): Promise<{ service: Service; slots: AnySlot[] }> {
    const range = localDayRange(date, query.business.timezone);
    const ctx = await this.load(query, range);
    const now = query.now ?? new Date();
    const rules = BusinessService.rulesOf(query.business, query.relaxed);
    const slots =
      ctx.schedules.length === 1
        ? computeProfessionalSlots({
            date,
            rules,
            now,
            durationMinutes: ctx.service.durationMinutes,
            schedule: ctx.schedules[0]!,
          }).map((s) => ({ ...s, professionalIds: [ctx.schedules[0]!.professionalId] }))
        : computeAnySlots({ date, rules, now, durationMinutes: ctx.service.durationMinutes, schedules: ctx.schedules });
    return { service: ctx.service, slots };
  }

  /** Datas (AAAA-MM-DD) entre from e to (inclusive) que têm pelo menos um horário livre. */
  async availableDays(query: AvailabilityQuery, from: LocalDate, to: LocalDate): Promise<string[]> {
    const days = Math.min(Math.max(diffInCalendarDays(from, to), 0), 62);
    const tz = query.business.timezone;
    const range: TimeRange = {
      start: localDayRange(from, tz).start,
      end: localDayRange(addCalendarDays(from, days), tz).end,
    };
    const ctx = await this.load(query, range);
    const now = query.now ?? new Date();
    const rules = BusinessService.rulesOf(query.business, query.relaxed);
    const result: string[] = [];
    for (let i = 0; i <= days; i++) {
      const date = addCalendarDays(from, i);
      const slots = computeAnySlots({ date, rules, now, durationMinutes: ctx.service.durationMinutes, schedules: ctx.schedules });
      if (slots.length > 0) result.push(formatLocalDate(date));
    }
    return result;
  }

  private async load(query: AvailabilityQuery, range: TimeRange): Promise<LoadedContext> {
    const { business, serviceId, professionalId } = query;
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, businessId: business.id, active: true } });
    if (!service) throw new NotFoundException('Serviço não encontrado.');

    const professionals = await this.prisma.professional.findMany({
      where: {
        businessId: business.id,
        active: true,
        services: { some: { serviceId } },
        ...(professionalId !== 'any' ? { id: professionalId } : {}),
      },
      include: { workingHours: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (professionalId !== 'any' && professionals.length === 0) {
      throw new NotFoundException('Profissional não encontrado para este serviço.');
    }
    const ids = professionals.map((p) => p.id);

    const [appointments, timeOffs] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          professionalId: { in: ids },
          status: { not: 'CANCELED' },
          startsAt: { lt: range.end },
          endsAt: { gt: range.start },
          ...(query.excludeAppointmentId ? { id: { not: query.excludeAppointmentId } } : {}),
        },
        select: { professionalId: true, startsAt: true, endsAt: true },
      }),
      this.prisma.timeOff.findMany({
        where: {
          businessId: business.id,
          OR: [{ professionalId: null }, { professionalId: { in: ids } }],
          startsAt: { lt: range.end },
          endsAt: { gt: range.start },
        },
        select: { professionalId: true, startsAt: true, endsAt: true },
      }),
    ]);

    const schedules: ProfessionalSchedule[] = professionals.map((p) => ({
      professionalId: p.id,
      workingHours: p.workingHours,
      busy: [
        ...appointments.filter((a) => a.professionalId === p.id),
        ...timeOffs.filter((t) => t.professionalId === null || t.professionalId === p.id),
      ].map((x) => ({ start: x.startsAt, end: x.endsAt })),
    }));

    return { service, professionals: professionals.map((p) => ({ id: p.id, name: p.name })), schedules };
  }
}
