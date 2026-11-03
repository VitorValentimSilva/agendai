import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AppointmentSource, AppointmentStatus, Business, Customer } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { localDayRange, toLocalDate, pickLeastBusyProfessional } from '../availability/availability.engine.js';
import { generateAppointmentCode, generateManageToken } from '../common/ids.js';
import { isOverlapViolation, isUniqueViolation } from '../common/prisma-errors.js';
import { isValidBrazilianWhatsapp, normalizeWhatsapp } from '../common/phone.js';
import type { SessionUser } from '../common/decorators.js';
import { env } from '../common/env.js';
import { formatLongDateTime } from '../common/dates.js';
import { appointmentInclude, type AppointmentWithRelations } from './appointment.mapper.js';
import { checkCustomerChange, checkStatusTransition } from './status-rules.js';
import { buildIcs } from './ics.js';
import type { CustomerInputDto } from './appointments.dto.js';

export const SLOT_TAKEN_MESSAGE = 'Ops! Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário, por favor.';

export interface BookingRequest {
  business: Business;
  serviceId: string;
  professionalId: string; // id ou "any"
  startsAt: string;
  customer: CustomerInputDto;
  notes?: string;
  source: AppointmentSource;
  /** Painel: ignora antecedência mínima e limite de dias. */
  relaxed?: boolean;
  now?: Date;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  async book(req: BookingRequest): Promise<AppointmentWithRelations> {
    const startsAt = new Date(req.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Horário inválido.');
    if (!isValidBrazilianWhatsapp(req.customer.whatsapp)) {
      throw new BadRequestException('Informe um WhatsApp válido com DDD.');
    }

    const { business } = req;
    const date = toLocalDate(startsAt, business.timezone);
    const { service, slots } = await this.availability.slotsForDate(
      { business, serviceId: req.serviceId, professionalId: req.professionalId, relaxed: req.relaxed, now: req.now },
      date,
    );
    const slot = slots.find((s) => s.start.getTime() === startsAt.getTime());
    if (!slot) throw new ConflictException('Esse horário não está mais disponível. Escolha outro, por favor.');

    const candidates =
      req.professionalId === 'any' ? await this.orderByLeastBusy(slot.professionalIds, business, startsAt) : slot.professionalIds;

    const customer = await this.upsertCustomer(business.id, req.customer);
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

    for (const professionalId of candidates) {
      try {
        return await this.createWithUniqueCode({
          businessId: business.id,
          serviceId: service.id,
          professionalId,
          customerId: customer.id,
          startsAt,
          endsAt,
          priceCents: service.priceCents,
          source: req.source,
          notes: req.notes ?? null,
        });
      } catch (error) {
        if (isOverlapViolation(error)) continue; // alguém reservou primeiro: tenta o próximo profissional livre
        throw error;
      }
    }
    throw new ConflictException(SLOT_TAKEN_MESSAGE);
  }

  async findByToken(token: string): Promise<AppointmentWithRelations> {
    const appointment = await this.prisma.appointment.findUnique({ where: { manageToken: token }, include: appointmentInclude });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado. Confira o link recebido.');
    return appointment;
  }

  async cancelByToken(token: string, now = new Date()): Promise<AppointmentWithRelations> {
    const appointment = await this.findByToken(token);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: appointment.businessId } });
    const check = checkCustomerChange(appointment, business.cancellationPolicyHours, now);
    if (!check.ok) throw new UnprocessableEntityException(check.reason);
    return this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CANCELED', canceledAt: now },
      include: appointmentInclude,
    });
  }

  async rescheduleByToken(token: string, newStart: string, now = new Date()): Promise<AppointmentWithRelations> {
    const appointment = await this.findByToken(token);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: appointment.businessId } });
    const check = checkCustomerChange(appointment, business.cancellationPolicyHours, now);
    if (!check.ok) throw new UnprocessableEntityException(check.reason);

    const startsAt = new Date(newStart);
    const { slots } = await this.availability.slotsForDate(
      {
        business,
        serviceId: appointment.serviceId,
        professionalId: appointment.professionalId,
        excludeAppointmentId: appointment.id,
        now,
      },
      toLocalDate(startsAt, business.timezone),
    );
    if (!slots.some((s) => s.start.getTime() === startsAt.getTime())) {
      throw new ConflictException('Esse horário não está disponível. Escolha outro, por favor.');
    }
    const duration = appointment.endsAt.getTime() - appointment.startsAt.getTime();
    try {
      return await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { startsAt, endsAt: new Date(startsAt.getTime() + duration), status: 'SCHEDULED' },
        include: appointmentInclude,
      });
    } catch (error) {
      if (isOverlapViolation(error)) throw new ConflictException(SLOT_TAKEN_MESSAGE);
      throw error;
    }
  }

  async icsByToken(token: string): Promise<{ filename: string; content: string }> {
    const a = await this.findByToken(token);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: a.businessId } });
    const manageUrl = `${env.webOrigin}/meu-agendamento/${a.manageToken}`;
    const content = buildIcs({
      uid: `${a.id}@agendai.app`,
      start: a.startsAt,
      end: a.endsAt,
      summary: `${a.service.name} — ${business.name}`,
      description: [
        `Profissional: ${a.professional.name}`,
        `Quando: ${formatLongDateTime(a.startsAt, business.timezone)}`,
        `Código: ${a.code}`,
        `Gerenciar: ${manageUrl}`,
      ].join('\n'),
      location: `${business.name}, ${business.addressLine}, ${business.city} - ${business.state}`,
      url: manageUrl,
    });
    return { filename: `agendamento-${a.code}.ics`, content };
  }

  // ---------- Painel ----------

  async findForUser(id: string, user: SessionUser): Promise<AppointmentWithRelations> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, businessId: user.businessId },
      include: appointmentInclude,
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado.');
    if (user.role === 'PROFESSIONAL' && appointment.professionalId !== user.professionalId) {
      throw new ForbiddenException('Você só pode gerenciar a sua própria agenda.');
    }
    return appointment;
  }

  async changeStatus(id: string, status: AppointmentStatus, user: SessionUser, now = new Date()) {
    const appointment = await this.findForUser(id, user);
    const check = checkStatusTransition(appointment, status, now);
    if (!check.ok) throw new UnprocessableEntityException(check.reason);
    return this.prisma.appointment.update({
      where: { id },
      data: { status, canceledAt: status === 'CANCELED' ? now : null },
      include: appointmentInclude,
    });
  }

  // ---------- Internos ----------

  private async orderByLeastBusy(ids: string[], business: Business, startsAt: Date): Promise<string[]> {
    const day = localDayRange(toLocalDate(startsAt, business.timezone), business.timezone);
    const counts = await this.prisma.appointment.groupBy({
      by: ['professionalId'],
      where: { professionalId: { in: ids }, status: { not: 'CANCELED' }, startsAt: { gte: day.start, lt: day.end } },
      _count: { _all: true },
    });
    const map = Object.fromEntries(counts.map((c) => [c.professionalId, c._count._all]));
    return pickLeastBusyProfessional(ids, map);
  }

  private async upsertCustomer(businessId: string, input: CustomerInputDto): Promise<Customer> {
    const whatsapp = normalizeWhatsapp(input.whatsapp);
    const data = { name: input.name, ...(input.email ? { email: input.email.toLowerCase() } : {}) };
    try {
      return await this.prisma.customer.upsert({
        where: { businessId_whatsapp: { businessId, whatsapp } },
        create: { businessId, whatsapp, ...data },
        update: data,
      });
    } catch (error) {
      // Dois pedidos simultâneos do mesmo cliente: o segundo encontra o registro criado pelo primeiro.
      if (isUniqueViolation(error)) {
        return this.prisma.customer.findUniqueOrThrow({ where: { businessId_whatsapp: { businessId, whatsapp } } });
      }
      throw error;
    }
  }

  private async createWithUniqueCode(data: {
    businessId: string;
    serviceId: string;
    professionalId: string;
    customerId: string;
    startsAt: Date;
    endsAt: Date;
    priceCents: number;
    source: AppointmentSource;
    notes: string | null;
  }): Promise<AppointmentWithRelations> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.appointment.create({
          data: { ...data, code: generateAppointmentCode(), manageToken: generateManageToken() },
          include: appointmentInclude,
        });
      } catch (error) {
        if (isUniqueViolation(error, 'code')) continue;
        throw error;
      }
    }
    throw new ConflictException('Não foi possível gerar o código do agendamento. Tente novamente.');
  }
}
