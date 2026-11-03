import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { BusinessService } from '../business/business.service.js';
import type { SessionUser } from '../common/decorators.js';
import {
  addCalendarDays,
  formatLocalDate,
  localDayRange,
  toLocalDate,
  weekdayOf,
  type LocalDate,
} from '../availability/availability.engine.js';
import { appointmentInclude, toAdminAppointment } from '../appointments/appointment.mapper.js';
import type { DashboardDto } from './admin.dto.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessService,
  ) {}

  async get(user: SessionUser, now = new Date()): Promise<DashboardDto> {
    const business = await this.businesses.getById(user.businessId);
    const tz = business.timezone;
    const today = toLocalDate(now, tz);
    const scope = {
      businessId: business.id,
      ...(user.role === 'PROFESSIONAL' && user.professionalId ? { professionalId: user.professionalId } : {}),
    };

    const monthStart: LocalDate = { ...today, day: 1 };
    const nextMonthStart: LocalDate =
      today.month === 12 ? { year: today.year + 1, month: 1, day: 1 } : { year: today.year, month: today.month + 1, day: 1 };
    const weekStart = addCalendarDays(today, -((weekdayOf(today) + 6) % 7)); // segunda-feira
    const weekEnd = addCalendarDays(weekStart, 7);
    const seriesStart = addCalendarDays(today, -29);

    const startCandidates = [monthStart, weekStart, seriesStart].map((d) => localDayRange(d, tz).start.getTime());
    const endCandidates = [nextMonthStart, weekEnd, addCalendarDays(today, 1)].map((d) => localDayRange(d, tz).start.getTime());
    const rangeStart = new Date(Math.min(...startCandidates));
    const rangeEnd = new Date(Math.max(...endCandidates));

    const rows = await this.prisma.appointment.findMany({
      where: { ...scope, startsAt: { gte: rangeStart, lt: rangeEnd } },
      select: { status: true, startsAt: true, priceCents: true, serviceId: true, service: { select: { name: true } } },
    });

    const within = (d: Date, from: LocalDate, to: LocalDate) =>
      d >= localDayRange(from, tz).start && d < localDayRange(to, tz).start;
    const active = rows.filter((r) => r.status !== 'CANCELED');
    const tomorrow = addCalendarDays(today, 1);

    const appointmentsToday = active.filter((r) => within(r.startsAt, today, tomorrow)).length;
    const appointmentsWeek = active.filter((r) => within(r.startsAt, weekStart, weekEnd)).length;

    const monthRows = rows.filter((r) => within(r.startsAt, monthStart, nextMonthStart));
    const expectedRevenueMonthCents = monthRows
      .filter((r) => r.status === 'SCHEDULED' || r.status === 'CONFIRMED' || r.status === 'COMPLETED')
      .reduce((s, r) => s + r.priceCents, 0);
    const realizedRevenueMonthCents = monthRows.filter((r) => r.status === 'COMPLETED').reduce((s, r) => s + r.priceCents, 0);

    // Taxas: últimos 30 dias até agora
    const last30 = rows.filter((r) => within(r.startsAt, seriesStart, tomorrow) && r.startsAt <= now);
    const canceled = last30.filter((r) => r.status === 'CANCELED').length;
    const noShows = last30.filter((r) => r.status === 'NO_SHOW').length;
    const attended = last30.filter((r) => r.status !== 'CANCELED').length;
    const cancellationRate = last30.length ? canceled / last30.length : 0;
    const noShowRate = attended ? noShows / attended : 0;

    const top = new Map<string, { serviceId: string; name: string; count: number; revenueCents: number }>();
    for (const r of last30.filter((x) => x.status === 'COMPLETED')) {
      const t = top.get(r.serviceId) ?? { serviceId: r.serviceId, name: r.service.name, count: 0, revenueCents: 0 };
      t.count += 1;
      t.revenueCents += r.priceCents;
      top.set(r.serviceId, t);
    }
    const topServices = [...top.values()].sort((a, b) => b.count - a.count || b.revenueCents - a.revenueCents).slice(0, 5);

    const series = Array.from({ length: 30 }, (_, i) => {
      const day = addCalendarDays(seriesStart, i);
      const next = addCalendarDays(day, 1);
      const dayRows = rows.filter((r) => within(r.startsAt, day, next));
      return {
        date: formatLocalDate(day),
        appointments: dayRows.filter((r) => r.status !== 'CANCELED').length,
        revenueCents: dayRows.filter((r) => r.status === 'COMPLETED').reduce((s, r) => s + r.priceCents, 0),
      };
    });

    const upcoming = await this.prisma.appointment.findMany({
      where: { ...scope, startsAt: { gte: now }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
      orderBy: { startsAt: 'asc' },
      take: 6,
      include: appointmentInclude,
    });

    return {
      timezone: tz,
      today: formatLocalDate(today),
      appointmentsToday,
      appointmentsWeek,
      expectedRevenueMonthCents,
      realizedRevenueMonthCents,
      cancellationRate,
      noShowRate,
      topServices,
      series,
      upcoming: upcoming.map(toAdminAppointment),
    };
  }
}
