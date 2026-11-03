import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service.js';
import { CurrentUser, type SessionUser } from '../common/decorators.js';
import { BusinessService } from '../business/business.service.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { appointmentInclude, toAdminAppointment } from '../appointments/appointment.mapper.js';
import { AdminAppointmentDto, UpdateStatusDto } from '../appointments/appointments.dto.js';
import { addCalendarDays, localDayRange } from '../availability/availability.engine.js';
import { formatTime, parseDateParam } from '../common/dates.js';
import { AvailabilityDto, AvailabilityQueryDto } from '../public/public.dto.js';
import { AdminController } from './admin.decorator.js';
import { AgendaDto, AgendaQueryDto, DashboardDto, ManualAppointmentDto } from './admin.dto.js';
import { DashboardService } from './dashboard.service.js';

function scopedProfessional(user: SessionUser, requested?: string): string | undefined {
  if (user.role === 'PROFESSIONAL') {
    if (requested && requested !== user.professionalId) {
      throw new ForbiddenException('Você só pode ver a sua própria agenda.');
    }
    return user.professionalId ?? '__none__';
  }
  return requested || undefined;
}

@AdminController('agenda')
@Controller('admin')
export class AgendaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessService,
    private readonly availability: AvailabilityService,
    private readonly appointments: AppointmentsService,
    private readonly dashboard: DashboardService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Métricas do painel (no papel PROFESSIONAL, só a própria agenda)' })
  @ApiOkResponse({ type: DashboardDto })
  getDashboard(@CurrentUser() user: SessionUser): Promise<DashboardDto> {
    return this.dashboard.get(user);
  }

  @Get('appointments')
  @ApiOperation({ summary: 'Agenda entre duas datas (inclusive), no fuso do negócio' })
  @ApiOkResponse({ type: AgendaDto })
  async agenda(@CurrentUser() user: SessionUser, @Query() q: AgendaQueryDto): Promise<AgendaDto> {
    const business = await this.businesses.getById(user.businessId);
    const tz = business.timezone;
    const start = localDayRange(parseDateParam(q.from, 'from'), tz).start;
    const end = localDayRange(addCalendarDays(parseDateParam(q.to, 'to'), 1), tz).start;
    const professionalId = scopedProfessional(user, q.professionalId);

    const [appointments, timeOffs] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { businessId: business.id, startsAt: { gte: start, lt: end }, ...(professionalId ? { professionalId } : {}) },
        orderBy: { startsAt: 'asc' },
        include: appointmentInclude,
      }),
      this.prisma.timeOff.findMany({
        where: {
          businessId: business.id,
          startsAt: { lt: end },
          endsAt: { gt: start },
          ...(professionalId ? { OR: [{ professionalId }, { professionalId: null }] } : {}),
        },
        orderBy: { startsAt: 'asc' },
      }),
    ]);
    return {
      timezone: tz,
      appointments: appointments.map(toAdminAppointment),
      timeOffs: timeOffs.map((t) => ({
        id: t.id,
        professionalId: t.professionalId,
        startsAt: t.startsAt.toISOString(),
        endsAt: t.endsAt.toISOString(),
        reason: t.reason,
      })),
    };
  }

  @Get('appointments/:id')
  @ApiOkResponse({ type: AdminAppointmentDto })
  async one(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<AdminAppointmentDto> {
    return toAdminAppointment(await this.appointments.findForUser(id, user));
  }

  @Post('appointments')
  @ApiOperation({ summary: 'Agendamento manual (balcão/telefone). Ignora antecedência mínima.' })
  @ApiCreatedResponse({ type: AdminAppointmentDto })
  async manual(@CurrentUser() user: SessionUser, @Body() dto: ManualAppointmentDto): Promise<AdminAppointmentDto> {
    const professionalId = user.role === 'PROFESSIONAL' ? scopedProfessional(user, dto.professionalId === 'any' ? undefined : dto.professionalId)! : dto.professionalId;
    const business = await this.businesses.getById(user.businessId);
    const created = await this.appointments.book({ ...dto, professionalId, business, source: 'MANUAL', relaxed: true });
    return toAdminAppointment(created);
  }

  @Patch('appointments/:id/status')
  @ApiOperation({ summary: 'Mudar status (confirmar, concluir, faltou, cancelar)' })
  @ApiOkResponse({ type: AdminAppointmentDto })
  async status(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: UpdateStatusDto): Promise<AdminAppointmentDto> {
    return toAdminAppointment(await this.appointments.changeStatus(id, dto.status, user));
  }

  @Get('availability')
  @ApiOperation({ summary: 'Horários livres para agendamento manual (sem antecedência mínima)' })
  @ApiOkResponse({ type: AvailabilityDto })
  async slots(@CurrentUser() user: SessionUser, @Query() q: AvailabilityQueryDto): Promise<AvailabilityDto> {
    const business = await this.businesses.getById(user.businessId);
    const professionalId = user.role === 'PROFESSIONAL' ? scopedProfessional(user, q.professionalId === 'any' ? undefined : q.professionalId)! : q.professionalId;
    const { slots } = await this.availability.slotsForDate(
      { business, serviceId: q.serviceId, professionalId, relaxed: true },
      parseDateParam(q.date),
    );
    return {
      date: q.date,
      timezone: business.timezone,
      slots: slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        time: formatTime(s.start, business.timezone),
        professionalIds: s.professionalIds,
      })),
    };
  }
}
