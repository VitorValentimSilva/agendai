import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import type { Response } from 'express';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { CurrentUser, type SessionUser } from '../common/decorators.js';
import { BusinessService } from '../business/business.service.js';
import { addCalendarDays, diffInCalendarDays, localDayRange } from '../availability/availability.engine.js';
import { formatIsoDate, formatTime, parseDateParam } from '../common/dates.js';
import { AdminController } from '../admin/admin.decorator.js';
import { STATUS_LABELS } from '../appointments/status-rules.js';
import { brlNumber, buildReport, commissionOf, toCsv } from './report.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

class ReportQueryDto {
  @ApiProperty({ example: '2026-10-01' }) @Matches(DATE) from: string;
  @ApiProperty({ example: '2026-10-31' }) @Matches(DATE) to: string;
  @ApiPropertyOptional() @IsOptional() @IsString() professionalId?: string;
}

class ProfessionalReportDto {
  @ApiProperty() professionalId: string;
  @ApiProperty() professionalName: string;
  @ApiProperty() commissionPercent: number;
  @ApiProperty() appointments: number;
  @ApiProperty() completed: number;
  @ApiProperty() noShows: number;
  @ApiProperty() canceled: number;
  @ApiProperty() revenueCents: number;
  @ApiProperty() commissionCents: number;
  @ApiProperty() averageTicketCents: number;
}

class ServiceReportDto {
  @ApiProperty() serviceId: string;
  @ApiProperty() serviceName: string;
  @ApiProperty() completed: number;
  @ApiProperty() revenueCents: number;
}

class ReportTotalsDto {
  @ApiProperty() appointments: number;
  @ApiProperty() completed: number;
  @ApiProperty() noShows: number;
  @ApiProperty() canceled: number;
  @ApiProperty() revenueCents: number;
  @ApiProperty() commissionCents: number;
  @ApiProperty() netRevenueCents: number;
}

export class ReportDto {
  @ApiProperty() from: string;
  @ApiProperty() to: string;
  @ApiProperty({ type: [ProfessionalReportDto] }) professionals: ProfessionalReportDto[];
  @ApiProperty({ type: [ServiceReportDto] }) services: ServiceReportDto[];
  @ApiProperty({ type: ReportTotalsDto }) totals: ReportTotalsDto;
}

@AdminController('relatórios')
@Controller('admin/reports')
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessService,
  ) {}

  /** Filtro do período (no fuso do negócio) e do escopo do usuário. */
  private async where(user: SessionUser, q: ReportQueryDto): Promise<{ where: Prisma.AppointmentWhereInput; timezone: string }> {
    const business = await this.businesses.getById(user.businessId);
    const from = parseDateParam(q.from, 'from');
    const to = parseDateParam(q.to, 'to');
    const days = diffInCalendarDays(from, to);
    if (days < 0) throw new BadRequestException('A data final precisa ser depois da inicial.');
    if (days > 366) throw new BadRequestException('Período máximo de 1 ano.');
    const professionalId =
      user.role === 'PROFESSIONAL' ? (user.professionalId ?? '__none__') : q.professionalId || undefined;
    return {
      timezone: business.timezone,
      where: {
        businessId: business.id,
        startsAt: {
          gte: localDayRange(from, business.timezone).start,
          lt: localDayRange(addCalendarDays(to, 1), business.timezone).start,
        },
        ...(professionalId ? { professionalId } : {}),
      },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Relatório do período: por profissional (comissão), por serviço e totais' })
  @ApiOkResponse({ type: ReportDto })
  async report(@CurrentUser() user: SessionUser, @Query() q: ReportQueryDto): Promise<ReportDto> {
    const { where } = await this.where(user, q);
    const rows = await this.prisma.appointment.findMany({
      where: { ...where, status: { not: 'PENDING_PAYMENT' } },
      select: {
        status: true,
        priceCents: true,
        professionalId: true,
        serviceId: true,
        professional: { select: { name: true, commissionPercent: true } },
        service: { select: { name: true } },
      },
    });
    const report = buildReport(
      rows.map((r) => ({
        status: r.status,
        priceCents: r.priceCents,
        professionalId: r.professionalId,
        professionalName: r.professional.name,
        commissionPercent: r.professional.commissionPercent,
        serviceId: r.serviceId,
        serviceName: r.service.name,
      })),
    );
    return { from: q.from, to: q.to, ...report };
  }

  @Get('appointments.csv')
  @ApiOperation({ summary: 'Exporta os agendamentos do período em CSV (Excel pt-BR)' })
  @ApiProduces('text/csv')
  async csv(@CurrentUser() user: SessionUser, @Query() q: ReportQueryDto, @Res() res: Response): Promise<void> {
    const { where, timezone } = await this.where(user, q);
    const rows = await this.prisma.appointment.findMany({
      where,
      include: { service: true, professional: true, customer: true, payment: true },
      orderBy: { startsAt: 'asc' },
      take: 20_000,
    });
    const csv = toCsv(
      ['Data', 'Hora', 'Código', 'Cliente', 'WhatsApp', 'Serviço', 'Profissional', 'Status', 'Origem', 'Valor (R$)', 'Comissão (R$)', 'Pix', 'Confirmado via'],
      rows.map((a) => [
        formatIsoDate(a.startsAt, timezone),
        formatTime(a.startsAt, timezone),
        a.code,
        a.customer.name,
        a.customer.whatsapp,
        a.service.name,
        a.professional.name,
        STATUS_LABELS[a.status],
        a.source === 'ONLINE' ? 'Site' : 'Manual',
        brlNumber(a.priceCents),
        a.status === 'COMPLETED' ? brlNumber(commissionOf(a.priceCents, a.professional.commissionPercent)) : '',
        a.payment ? `${a.payment.status} ${brlNumber(a.payment.amountCents)}` : '',
        a.confirmedVia ?? '',
      ]),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="agendamentos-${q.from}-a-${q.to}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }
}
