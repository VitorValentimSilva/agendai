import { Body, Controller, Get, Header, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../common/prisma.service.js';
import { BusinessService } from '../business/business.service.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { toPublicAppointment } from '../appointments/appointment.mapper.js';
import { CreateAppointmentDto, CreatedAppointmentDto, PublicAppointmentDto, RescheduleDto } from '../appointments/appointments.dto.js';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.js';
import { parseDateParam, formatTime } from '../common/dates.js';
import { env } from '../common/env.js';
import {
  AvailabilityDto,
  AvailabilityQueryDto,
  AvailableDaysDto,
  AvailableDaysQueryDto,
  PublicBusinessDto,
  PublicProfessionalDto,
  PublicServiceDto,
} from './public.dto.js';

@ApiTags('Público')
@UseGuards(RateLimitGuard)
@Controller()
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessService,
    private readonly availability: AvailabilityService,
    private readonly appointments: AppointmentsService,
  ) {}

  @Get('business')
  @ApiOperation({ summary: 'Dados públicos do negócio' })
  @ApiOkResponse({ type: PublicBusinessDto })
  async business(): Promise<PublicBusinessDto> {
    const b = await this.businesses.getPublicBusiness();
    return {
      name: b.name,
      slug: b.slug,
      description: b.description,
      phone: b.phone,
      whatsapp: b.whatsapp,
      email: b.email,
      instagram: b.instagram,
      addressLine: b.addressLine,
      city: b.city,
      state: b.state,
      timezone: b.timezone,
      slotIntervalMinutes: b.slotIntervalMinutes,
      minAdvanceMinutes: b.minAdvanceMinutes,
      maxAdvanceDays: b.maxAdvanceDays,
      cancellationPolicyHours: b.cancellationPolicyHours,
      openingHours: await this.businesses.openingHours(b.id),
    };
  }

  @Get('services')
  @ApiOperation({ summary: 'Serviços ativos' })
  @ApiOkResponse({ type: [PublicServiceDto] })
  async services(): Promise<PublicServiceDto[]> {
    const b = await this.businesses.getPublicBusiness();
    return this.prisma.service.findMany({
      where: { businessId: b.id, active: true, professionals: { some: { professional: { active: true } } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, description: true, durationMinutes: true, priceCents: true },
    });
  }

  @Get('professionals')
  @ApiOperation({ summary: 'Equipe (profissionais ativos)' })
  @ApiOkResponse({ type: [PublicProfessionalDto] })
  async team(): Promise<PublicProfessionalDto[]> {
    const b = await this.businesses.getPublicBusiness();
    return this.prisma.professional.findMany({
      where: { businessId: b.id, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, bio: true, avatarUrl: true },
    });
  }

  @Get('services/:serviceId/professionals')
  @ApiOperation({ summary: 'Profissionais que fazem o serviço' })
  @ApiOkResponse({ type: [PublicProfessionalDto] })
  async professionals(@Param('serviceId') serviceId: string): Promise<PublicProfessionalDto[]> {
    const b = await this.businesses.getPublicBusiness();
    return this.prisma.professional.findMany({
      where: { businessId: b.id, active: true, services: { some: { serviceId, service: { active: true } } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, bio: true, avatarUrl: true },
    });
  }

  @Get('availability')
  @ApiOperation({ summary: 'Horários livres em uma data (fuso do negócio)' })
  @ApiOkResponse({ type: AvailabilityDto })
  async slots(@Query() q: AvailabilityQueryDto): Promise<AvailabilityDto> {
    const business = await this.businesses.getPublicBusiness();
    const { slots } = await this.availability.slotsForDate(
      { business, serviceId: q.serviceId, professionalId: q.professionalId },
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

  @Get('availability/days')
  @ApiOperation({ summary: 'Dias com pelo menos um horário livre (para o calendário)' })
  @ApiOkResponse({ type: AvailableDaysDto })
  async days(@Query() q: AvailableDaysQueryDto): Promise<AvailableDaysDto> {
    const business = await this.businesses.getPublicBusiness();
    const days = await this.availability.availableDays(
      { business, serviceId: q.serviceId, professionalId: q.professionalId },
      parseDateParam(q.from, 'from'),
      parseDateParam(q.to, 'to'),
    );
    return { days };
  }

  @Post('appointments')
  @RateLimit({ limit: env.bookingThrottleLimit })
  @ApiOperation({ summary: 'Criar agendamento (cliente)' })
  @ApiCreatedResponse({ type: CreatedAppointmentDto })
  @ApiConflictResponse({ description: 'Horário indisponível ou reservado por outra pessoa' })
  async create(@Body() dto: CreateAppointmentDto): Promise<CreatedAppointmentDto> {
    const business = await this.businesses.getPublicBusiness();
    const appointment = await this.appointments.book({ ...dto, business, source: 'ONLINE' });
    return { ...toPublicAppointment(appointment, business), manageToken: appointment.manageToken };
  }

  @Get('appointments/manage/:token')
  @ApiOperation({ summary: 'Ver agendamento pelo token' })
  @ApiOkResponse({ type: PublicAppointmentDto })
  async byToken(@Param('token') token: string): Promise<PublicAppointmentDto> {
    const a = await this.appointments.findByToken(token);
    return toPublicAppointment(a, await this.businesses.getById(a.businessId));
  }

  @Post('appointments/manage/:token/cancel')
  @RateLimit({ limit: env.bookingThrottleLimit })
  @ApiOperation({ summary: 'Cancelar pelo token (respeita a política de cancelamento)' })
  @ApiCreatedResponse({ type: PublicAppointmentDto })
  async cancel(@Param('token') token: string): Promise<PublicAppointmentDto> {
    const a = await this.appointments.cancelByToken(token);
    return toPublicAppointment(a, await this.businesses.getById(a.businessId));
  }

  @Post('appointments/manage/:token/reschedule')
  @RateLimit({ limit: env.bookingThrottleLimit })
  @ApiOperation({ summary: 'Remarcar pelo token (mesmo serviço e profissional)' })
  @ApiCreatedResponse({ type: PublicAppointmentDto })
  async reschedule(@Param('token') token: string, @Body() dto: RescheduleDto): Promise<PublicAppointmentDto> {
    const a = await this.appointments.rescheduleByToken(token, dto.startsAt);
    return toPublicAppointment(a, await this.businesses.getById(a.businessId));
  }

  @Get('appointments/manage/:token/ics')
  @ApiOperation({ summary: 'Baixar o agendamento em .ics' })
  @ApiProduces('text/calendar')
  @Header('Cache-Control', 'no-store')
  async ics(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const { filename, content } = await this.appointments.icsByToken(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }
}
