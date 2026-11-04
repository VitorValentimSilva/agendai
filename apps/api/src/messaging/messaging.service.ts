import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Business } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { env } from '../common/env.js';
import { formatTime } from '../common/dates.js';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { appointmentInclude, type AppointmentWithRelations } from '../appointments/appointment.mapper.js';
import { checkCustomerChange } from '../appointments/status-rules.js';
import { WhatsAppClient } from './whatsapp.client.js';
import { firstName, parseReply, phoneVariants, reminderText } from './messages.js';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ReminderRunResult {
  sent: number;
  failed: number;
}

const dateLabel = (d: Date, tz: string) => format(new TZDate(d.getTime(), tz), "EEEE, d 'de' MMMM", { locale: ptBR });

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppClient,
    private readonly appointments: AppointmentsService,
  ) {}

  get provider() {
    return this.whatsapp.provider;
  }

  /** Envia uma mensagem e registra no histórico (inclusive falhas). */
  async send(args: {
    businessId: string;
    appointmentId?: string;
    customerId?: string;
    phone: string;
    kind: 'reminder' | 'waitlist' | 'reply';
    text: string;
    template?: { name: string; bodyParams: string[]; quickReplyPayloads?: string[] };
  }): Promise<boolean> {
    let providerMessageId: string | null = null;
    let error: string | null = null;
    try {
      const result = args.template?.name
        ? await this.whatsapp.sendTemplate(args.phone, args.template)
        : await this.whatsapp.sendText(args.phone, args.text);
      providerMessageId = result.messageId;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    await this.prisma.messageLog.create({
      data: {
        businessId: args.businessId,
        appointmentId: args.appointmentId ?? null,
        customerId: args.customerId ?? null,
        direction: 'OUT',
        kind: args.kind,
        phone: args.phone,
        body: args.text,
        provider: this.whatsapp.provider,
        providerMessageId,
        status: error ? 'failed' : 'sent',
        error,
      },
    });
    return !error;
  }

  /** Lembrete de um agendamento (marca reminderSentAt se enviar). */
  async sendReminder(a: AppointmentWithRelations, business: Business): Promise<boolean> {
    const askConfirmation = a.status === 'SCHEDULED';
    const info = {
      customerName: a.customer.name,
      businessName: business.name,
      serviceName: a.service.name,
      professionalName: a.professional.name,
      dateLabel: dateLabel(a.startsAt, business.timezone),
      time: formatTime(a.startsAt, business.timezone),
      manageUrl: `${env.webOrigin}/meu-agendamento/${a.manageToken}`,
      askConfirmation,
    };
    const ok = await this.send({
      businessId: business.id,
      appointmentId: a.id,
      customerId: a.customerId,
      phone: a.customer.whatsapp,
      kind: 'reminder',
      text: reminderText(info),
      template: env.whatsappReminderTemplate
        ? {
            name: env.whatsappReminderTemplate,
            bodyParams: [firstName(info.customerName), info.businessName, info.serviceName, info.professionalName, info.dateLabel, info.time],
            quickReplyPayloads: [`CONFIRMAR:${a.id}`, `CANCELAR:${a.id}`],
          }
        : undefined,
    });
    if (ok) await this.prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: new Date() } });
    return ok;
  }

  /**
   * Envia os lembretes devidos: agendamentos ativos que começam dentro da janela
   * `reminderHoursBefore` do negócio e ainda não foram lembrados.
   */
  async sendDueReminders(now = new Date(), businessId?: string): Promise<ReminderRunResult> {
    const businesses = await this.prisma.business.findMany({
      where: { remindersEnabled: true, ...(businessId ? { id: businessId } : {}) },
    });
    const result: ReminderRunResult = { sent: 0, failed: 0 };
    for (const business of businesses) {
      const due = await this.prisma.appointment.findMany({
        where: {
          businessId: business.id,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          reminderSentAt: null,
          startsAt: { gt: now, lte: new Date(now.getTime() + business.reminderHoursBefore * 3_600_000) },
        },
        include: appointmentInclude,
        orderBy: { startsAt: 'asc' },
        take: 200,
      });
      for (const a of due) {
        if (await this.sendReminder(a, business)) result.sent++;
        else result.failed++;
      }
    }
    if (result.sent || result.failed) this.logger.log(`Lembretes: ${result.sent} enviados, ${result.failed} falharam`);
    return result;
  }

  /**
   * Resposta do cliente (webhook ou simulação). Confirma ou cancela o agendamento
   * lembrado mais recentemente para aquele número e responde com o resultado.
   */
  async handleInbound(input: { from: string; text?: string; buttonPayload?: string; providerMessageId?: string }, now = new Date()) {
    const phones = phoneVariants(input.from);
    const intent = parseReply(input);
    const target = await this.findTarget(phones, intent.kind !== 'unknown' ? intent.appointmentId : undefined, now);

    if (target) {
      await this.prisma.messageLog.create({
        data: {
          businessId: target.businessId,
          appointmentId: target.id,
          customerId: target.customerId,
          direction: 'IN',
          kind: 'inbound',
          phone: input.from,
          body: input.text ?? input.buttonPayload ?? '',
          provider: this.whatsapp.provider,
          providerMessageId: input.providerMessageId ?? null,
        },
      });
    }
    if (!target || intent.kind === 'unknown') return { handled: false as const };

    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: target.businessId } });
    const when = `${dateLabel(target.startsAt, business.timezone)} às ${formatTime(target.startsAt, business.timezone)}`;
    let reply: string;
    let action: 'confirmed' | 'canceled' | 'rejected';

    if (intent.kind === 'confirm') {
      if (target.status === 'SCHEDULED') await this.appointments.confirm(target.id, 'WHATSAPP');
      reply = `Perfeito, ${firstName(target.customer.name)}! Seu horário de ${target.service.name} está confirmado para ${when}. Até lá!`;
      action = 'confirmed';
    } else {
      const check = checkCustomerChange(target, business.cancellationPolicyHours, now);
      if (check.ok) {
        await this.appointments.cancel(target.id, now);
        reply = `Tudo certo, cancelamos seu horário de ${when}. Quando quiser, é só agendar de novo: ${env.webOrigin}`;
        action = 'canceled';
      } else {
        reply = `Não foi possível cancelar pelo WhatsApp: ${check.reason}`;
        action = 'rejected';
      }
    }
    await this.send({ businessId: business.id, appointmentId: target.id, customerId: target.customerId, phone: target.customer.whatsapp, kind: 'reply', text: reply });
    return { handled: true as const, action, appointmentId: target.id };
  }

  /** Simulação da resposta do cliente (só no modo simulado — para demonstrar o fluxo). */
  async simulateReply(businessId: string, appointmentId: string, reply: string) {
    if (!this.whatsapp.isSimulated) {
      throw new BadRequestException('Simulação disponível apenas no modo simulado (sem WHATSAPP_TOKEN).');
    }
    const a = await this.prisma.appointment.findFirst({ where: { id: appointmentId, businessId }, include: { customer: true } });
    if (!a) throw new NotFoundException('Agendamento não encontrado.');
    const payload = reply === '1' ? `CONFIRMAR:${a.id}` : reply === '2' ? `CANCELAR:${a.id}` : undefined;
    return this.handleInbound({ from: a.customer.whatsapp, text: reply, buttonPayload: payload });
  }

  private async findTarget(phones: string[], appointmentId: string | undefined, now: Date) {
    const where = {
      status: { in: ['SCHEDULED', 'CONFIRMED'] as ('SCHEDULED' | 'CONFIRMED')[] },
      startsAt: { gt: now },
      customer: { whatsapp: { in: phones } },
    };
    if (appointmentId) {
      const byId = await this.prisma.appointment.findFirst({ where: { ...where, id: appointmentId }, include: appointmentInclude });
      if (byId) return byId;
    }
    return this.prisma.appointment.findFirst({
      where: { ...where, reminderSentAt: { not: null } },
      orderBy: [{ reminderSentAt: 'desc' }],
      include: appointmentInclude,
    });
  }
}
