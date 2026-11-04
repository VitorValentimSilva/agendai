import { BadRequestException, Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import type { Business, WaitlistStatus } from '@prisma/client';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PrismaService } from '../common/prisma.service.js';
import { env } from '../common/env.js';
import { randomToken } from '../common/crypto.js';
import { findOrCreateCustomer } from '../common/customers.js';
import { parseDateParam } from '../common/dates.js';
import { isValidBrazilianWhatsapp } from '../common/phone.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { isWithinBookingWindow, localMinuteToInstant, toLocalDate, formatLocalDate } from '../availability/availability.engine.js';
import { BusinessService } from '../business/business.service.js';
import { AppointmentEvents, type AppointmentEvent } from '../appointments/appointment-events.js';
import type { AppointmentWithRelations } from '../appointments/appointment.mapper.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { firstName, waitlistText } from '../messaging/messages.js';
import type { JoinWaitlistDto, WaitlistEntryPublicDto } from './waitlist.dto.js';

/** Limite de avisos por horário liberado (quem agendar primeiro leva). */
const MAX_NOTIFY_PER_EVENT = 15;

@Injectable()
export class WaitlistService implements OnModuleInit {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly messaging: MessagingService,
    private readonly events: AppointmentEvents,
  ) {}

  onModuleInit(): void {
    this.events.register({ onAppointmentEvent: (event, a) => this.onAppointmentEvent(event, a) });
  }

  async join(business: Business, dto: JoinWaitlistDto, now = new Date()): Promise<WaitlistEntryPublicDto> {
    if (!isValidBrazilianWhatsapp(dto.customer.whatsapp)) throw new BadRequestException('Informe um WhatsApp válido com DDD.');
    const date = parseDateParam(dto.date);
    if (!isWithinBookingWindow(date, BusinessService.rulesOf(business), now)) {
      throw new BadRequestException('Escolha uma data dentro do período de agendamento.');
    }
    const service = await this.prisma.service.findFirst({ where: { id: dto.serviceId, businessId: business.id, active: true } });
    if (!service) throw new NotFoundException('Serviço não encontrado.');
    let professional: { id: string; name: string } | null = null;
    if (dto.professionalId !== 'any') {
      professional = await this.prisma.professional.findFirst({
        where: { id: dto.professionalId, businessId: business.id, active: true, services: { some: { serviceId: service.id } } },
        select: { id: true, name: true },
      });
      if (!professional) throw new NotFoundException('Profissional não encontrado para este serviço.');
    }
    const customer = await findOrCreateCustomer(this.prisma, business.id, dto.customer, false);
    const dateStr = formatLocalDate(date);
    const entry = await this.prisma.waitlistEntry.upsert({
      where: { customerId_serviceId_date: { customerId: customer.id, serviceId: service.id, date: dateStr } },
      create: {
        businessId: business.id,
        serviceId: service.id,
        professionalId: professional?.id ?? null,
        customerId: customer.id,
        date: dateStr,
        token: randomToken(),
      },
      update: { status: 'ACTIVE', professionalId: professional?.id ?? null, notifiedAt: null },
    });
    return { token: entry.token, date: entry.date, serviceName: service.name, professionalName: professional?.name ?? null, status: entry.status };
  }

  async leave(token: string): Promise<void> {
    const updated = await this.prisma.waitlistEntry.updateMany({ where: { token, status: { in: ['ACTIVE', 'NOTIFIED'] } }, data: { status: 'CANCELED' } });
    if (!updated.count) throw new NotFoundException('Inscrição não encontrada ou já encerrada.');
  }

  private async onAppointmentEvent(event: AppointmentEvent, a: AppointmentWithRelations): Promise<void> {
    const business = await this.prisma.business.findUnique({ where: { id: a.businessId } });
    if (!business) return;
    const date = formatLocalDate(toLocalDate(a.startsAt, business.timezone));
    if (event === 'created') {
      // O cliente da fila conseguiu agendar: sai da fila daquele dia/serviço
      await this.prisma.waitlistEntry.updateMany({
        where: { customerId: a.customerId, serviceId: a.serviceId, date, status: { in: ['ACTIVE', 'NOTIFIED'] } },
        data: { status: 'BOOKED' },
      });
      return;
    }
    if ((event === 'canceled' || event === 'slot-freed') && a.startsAt > new Date()) await this.notifyFreed(business, date);
  }

  /** Um horário foi liberado em `date`: avisa quem está na fila e agora tem vaga. */
  async notifyFreed(business: Business, date: string): Promise<number> {
    const entries = await this.prisma.waitlistEntry.findMany({
      where: { businessId: business.id, date, status: 'ACTIVE' },
      include: { customer: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_NOTIFY_PER_EVENT,
    });
    let notified = 0;
    const localDate = parseDateParam(date);
    for (const entry of entries) {
      const { slots, service } = await this.availability.slotsForDate(
        { business, serviceId: entry.serviceId, professionalId: entry.professionalId ?? 'any' },
        localDate,
      );
      if (slots.length === 0) continue;
      const params = new URLSearchParams({ servico: entry.serviceId, data: date, ...(entry.professionalId ? { profissional: entry.professionalId } : {}) });
      const bookUrl = `${env.webOrigin}/n/${business.slug}/agendar?${params.toString()}`;
      const dateLabel = format(new TZDate(localMinuteToInstant(localDate, 12 * 60, business.timezone).getTime(), business.timezone), "EEEE, d 'de' MMMM", { locale: ptBR });
      const sent = await this.messaging.send({
        businessId: business.id,
        customerId: entry.customerId,
        phone: entry.customer.whatsapp,
        kind: 'waitlist',
        text: waitlistText({ customerName: entry.customer.name, businessName: business.name, serviceName: service.name, dateLabel, bookUrl }),
        template: env.whatsappWaitlistTemplate
          ? { name: env.whatsappWaitlistTemplate, bodyParams: [firstName(entry.customer.name), business.name, service.name, dateLabel, bookUrl] }
          : undefined,
      });
      if (sent) {
        await this.prisma.waitlistEntry.update({ where: { id: entry.id }, data: { status: 'NOTIFIED', notifiedAt: new Date() } });
        notified++;
      }
    }
    if (notified) this.logger.log(`Fila de espera: ${notified} cliente(s) avisado(s) para ${date}`);
    return notified;
  }

  async listForAdmin(businessId: string, professionalId: string | null, status: WaitlistStatus | 'ALL' = 'ALL') {
    return this.prisma.waitlistEntry.findMany({
      where: {
        businessId,
        ...(status !== 'ALL' ? { status } : {}),
        ...(professionalId ? { OR: [{ professionalId }, { professionalId: null }] } : {}),
      },
      include: { customer: true, professional: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    });
  }
}
