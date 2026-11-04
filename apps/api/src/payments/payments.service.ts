import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Business, Payment } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { env } from '../common/env.js';
import { decryptSecret } from '../common/crypto.js';
import { AppointmentsService } from '../appointments/appointments.service.js';
import type { AppointmentWithRelations } from '../appointments/appointment.mapper.js';
import { MercadoPagoClient } from './mercadopago.client.js';
import { amountToCharge } from './payment-rules.js';
import { DEMO_SLUG } from '../demo/demo-data.js';

export type PixProvider = 'MERCADO_PAGO' | 'SIMULATED';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mp: MercadoPagoClient,
    private readonly appointments: AppointmentsService,
  ) {}

  /** Token do negócio (cifrado no banco) ou o da plataforma; sem nenhum → simulado. */
  accessTokenFor(business: Pick<Business, 'mercadoPagoTokenEnc'>): string | null {
    if (business.mercadoPagoTokenEnc) {
      try {
        return decryptSecret(business.mercadoPagoTokenEnc);
      } catch (error) {
        this.logger.error('Não foi possível decifrar o token do Mercado Pago do negócio', error as Error);
      }
    }
    return env.mpAccessToken || null;
  }

  providerFor(business: Pick<Business, 'mercadoPagoTokenEnc'>): PixProvider {
    return this.accessTokenFor(business) ? 'MERCADO_PAGO' : 'SIMULATED';
  }

  /**
   * Pix simulado só vale na demonstração: em produção, um negócio real sem token do Mercado Pago
   * deixaria o cliente "simular" o próprio pagamento e confirmar sem pagar.
   */
  canSimulate(business: Pick<Business, 'slug'>): boolean {
    return env.allowSimulations || business.slug === DEMO_SLUG;
  }

  /** O negócio cobra Pix nos agendamentos online? (exige provedor real fora da demo) */
  chargesPix(business: Business): boolean {
    if (business.paymentMode === 'NONE') return false;
    return this.providerFor(business) === 'MERCADO_PAGO' || this.canSimulate(business);
  }

  /** Quanto este agendamento online precisa pagar agora (0 = nada). */
  amountFor(business: Business, priceCents: number): number {
    return amountToCharge(priceCents, business.paymentMode, business.depositPercent);
  }

  /** Gera a cobrança Pix de um agendamento recém-criado como PENDING_PAYMENT. */
  async createForAppointment(a: AppointmentWithRelations, business: Business, amountCents: number): Promise<Payment> {
    const expiresAt = new Date(Date.now() + business.paymentExpiryMinutes * 60_000);
    const token = this.accessTokenFor(business);
    try {
      const charge = token
        ? await this.mp.createPix({
            accessToken: token,
            amountCents,
            description: `${a.service.name} — ${business.name} (${a.code})`,
            payerEmail: a.customer.email ?? business.email ?? 'pagador@agendai.app',
            payerFirstName: a.customer.name.split(' ')[0] ?? a.customer.name,
            externalReference: a.id,
            expiresAt,
            notificationUrl: env.publicApiUrl.startsWith('https://') ? `${env.publicApiUrl}/webhooks/mercadopago` : null,
            idempotencyKey: a.id,
          })
        : this.mp.simulatedPix(amountCents, a.id);
      return await this.prisma.payment.create({
        data: {
          appointmentId: a.id,
          provider: token ? 'MERCADO_PAGO' : 'SIMULATED',
          providerPaymentId: charge.providerPaymentId,
          amountCents,
          qrCode: charge.qrCode,
          qrCodeBase64: charge.qrCodeBase64,
          ticketUrl: charge.ticketUrl,
          expiresAt,
        },
      });
    } catch (error) {
      // Sem cobrança não dá para segurar o horário: libera e avisa.
      await this.appointments.cancel(a.id, new Date(), ['PENDING_PAYMENT']);
      this.logger.error('Falha ao gerar o Pix', error as Error);
      throw new BadGatewayException('Não foi possível gerar o Pix agora. Tente novamente em instantes.');
    }
  }

  /**
   * Cancela agendamentos cujo Pix expirou (libera o horário e avisa a fila de espera).
   * Cada passo é condicional: se o pagamento for confirmado no meio do caminho, ele vence.
   */
  async expireStale(now = new Date()): Promise<number> {
    const stale = await this.prisma.payment.findMany({
      where: { status: 'PENDING', expiresAt: { lt: now }, appointment: { status: 'PENDING_PAYMENT' } },
      select: { id: true, appointmentId: true },
      take: 100,
    });
    let expired = 0;
    for (const p of stale) {
      const claimed = await this.prisma.payment.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      if (!claimed.count) continue; // outro processo (webhook/expiração paralela) chegou antes
      await this.appointments.cancel(p.appointmentId, now, ['PENDING_PAYMENT']);
      expired++;
    }
    return expired;
  }

  /** Pagamento confirmado: marca como pago e confirma o agendamento (idempotente e sem corrida). */
  async markPaid(payment: Payment, now = new Date()): Promise<void> {
    const claimed = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: { not: 'PAID' } },
      data: { status: 'PAID', paidAt: now },
    });
    if (!claimed.count) return; // notificação repetida
    const confirmed = await this.appointments.confirm(payment.appointmentId, 'PIX', ['PENDING_PAYMENT']);
    if (!confirmed) {
      const appointment = await this.prisma.appointment.findUniqueOrThrow({ where: { id: payment.appointmentId } });
      if (appointment.status === 'CANCELED') {
        // Pagou depois de expirar: o horário pode ter sido ocupado. Fica registrado para estorno manual.
        this.logger.warn(`Pix pago após cancelamento do agendamento ${appointment.id} — estorno manual necessário.`);
      }
    }
  }

  /**
   * Notificação do Mercado Pago: nunca confiamos no corpo — consultamos o pagamento
   * na API com o token do negócio dono da cobrança.
   */
  async handleNotification(providerPaymentId: string): Promise<'paid' | 'canceled' | 'ignored'> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerPaymentId },
      include: { appointment: { include: { business: true } } },
    });
    if (!payment || payment.provider !== 'MERCADO_PAGO') return 'ignored';
    const token = this.accessTokenFor(payment.appointment.business);
    if (!token) return 'ignored';
    const { status, externalReference } = await this.mp.getStatus(token, providerPaymentId);
    if (externalReference && externalReference !== payment.appointmentId) return 'ignored';
    if (status === 'approved') {
      await this.markPaid(payment);
      return 'paid';
    }
    if ((status === 'cancelled' || status === 'rejected') && payment.status === 'PENDING') {
      const claimed = await this.prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'CANCELED' } });
      if (claimed.count) await this.appointments.cancel(payment.appointmentId, new Date(), ['PENDING_PAYMENT']);
      return 'canceled';
    }
    return 'ignored';
  }

  /** Demonstração: "pagar" um Pix simulado pelo link do cliente. */
  async simulatePayment(manageToken: string): Promise<void> {
    const payment = await this.prisma.payment.findFirst({ where: { appointment: { manageToken } }, include: { appointment: { include: { business: true } } } });
    if (!payment) throw new NotFoundException('Este agendamento não tem Pix pendente.');
    if (payment.provider !== 'SIMULATED' || !this.canSimulate(payment.appointment.business)) throw new BadRequestException('Só é possível simular pagamentos do modo de demonstração.');
    if (payment.status !== 'PENDING') throw new BadRequestException('Este Pix não está mais pendente.');
    await this.markPaid(payment);
  }

  /** Cancela a cobrança pendente quando o agendamento é cancelado. */
  async cancelPendingFor(appointmentId: string): Promise<void> {
    await this.prisma.payment.updateMany({ where: { appointmentId, status: 'PENDING' }, data: { status: 'CANCELED' } });
  }
}
