import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Business, Payment } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { env } from '../common/env.js';
import { decryptSecret } from '../common/crypto.js';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { appointmentInclude, type AppointmentWithRelations } from '../appointments/appointment.mapper.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { firstName } from '../messaging/messages.js';
import { formatLongDateTime } from '../common/dates.js';
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
    private readonly messaging: MessagingService,
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
            payerEmail: a.customer.email ?? business.email ?? 'pagador@agendai.app',
            payerFirstName: a.customer.name.split(' ')[0] ?? a.customer.name,
            externalReference: a.id,
            expirationMinutes: business.paymentExpiryMinutes,
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
      await this.cancelAtProvider(p.id);
      await this.appointments.cancel(p.appointmentId, now, ['PENDING_PAYMENT']);
      expired++;
    }
    return expired;
  }

  /** Pagamento confirmado: marca como pago e confirma o agendamento (idempotente e sem corrida). */
  async markPaid(payment: Payment, now = new Date()): Promise<void> {
    // Marca como pago lembrando o status anterior (EXPIRED decide se dá para reativar). Se a expiração
    // mudar o status entre a leitura e a escrita, tenta de novo — o pagamento nunca pode se perder.
    let current: { status: Payment['status'] } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      current = await this.prisma.payment.findUnique({ where: { id: payment.id }, select: { status: true } });
      if (!current || current.status === 'PAID' || current.status === 'REFUNDED') return; // notificação repetida
      const claimed = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: current.status },
        data: { status: 'PAID', paidAt: now },
      });
      if (claimed.count) break;
      current = null;
    }
    if (!current) {
      this.logger.error(`Não foi possível registrar o pagamento ${payment.id} (status mudando sem parar).`);
      return;
    }
    const confirmed = await this.appointments.confirm(payment.appointmentId, 'PIX', ['PENDING_PAYMENT']);
    if (confirmed) return;
    const appointment = await this.prisma.appointment.findUniqueOrThrow({ where: { id: payment.appointmentId } });
    if (appointment.status !== 'CANCELED') return;
    // Pagou depois do agendamento ser cancelado. Se foi a expiração do Pix e o horário continua livre,
    // reativa; se o cliente desistiu, o horário passou ou alguém ocupou, devolve o dinheiro.
    const canReactivate = current.status === 'EXPIRED' && appointment.startsAt > now;
    if (canReactivate && (await this.appointments.reactivate(appointment.id, 'PIX'))) {
      await this.notifyLatePayment(payment.appointmentId, 'reactivated');
      return;
    }
    await this.refund(payment.id);
  }

  /**
   * Estorna um Pix pago (total). Simulado: só marca como estornado.
   * Se o Mercado Pago recusar, mantém PAID e o caso aparece no painel como "Pix a estornar".
   */
  async refund(paymentId: string): Promise<boolean> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { appointment: { include: { business: true } } },
    });
    if (payment.status !== 'PAID') return false;
    if (payment.provider === 'MERCADO_PAGO') {
      const token = this.accessTokenFor(payment.appointment.business);
      try {
        if (!token || !payment.providerPaymentId) throw new Error('sem access token ou id do pagamento');
        await this.mp.refund(token, payment.providerPaymentId, `refund-${payment.id}`);
      } catch (error) {
        this.logger.error(`Estorno do Pix ${payment.id} falhou — fica pendente no painel`, error as Error);
        return false;
      }
    }
    const done = await this.prisma.payment.updateMany({ where: { id: payment.id, status: 'PAID' }, data: { status: 'REFUNDED' } });
    if (done.count) await this.notifyLatePayment(payment.appointmentId, 'refunded');
    return done.count > 0;
  }

  /** Avisa o cliente pelo WhatsApp do que aconteceu com o Pix pago fora do prazo. */
  private async notifyLatePayment(appointmentId: string, outcome: 'reactivated' | 'refunded'): Promise<void> {
    try {
      const a = await this.prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: { ...appointmentInclude, business: true } });
      const when = `${formatLongDateTime(a.startsAt, a.business.timezone)}`;
      const text =
        outcome === 'reactivated'
          ? `Olá, ${firstName(a.customer.name)}! Recebemos seu Pix e seu horário de ${a.service.name} em ${a.business.name} está confirmado: ${when}.`
          : `Olá, ${firstName(a.customer.name)}! Seu Pix para ${a.service.name} em ${a.business.name} chegou depois do prazo e o horário não estava mais disponível. Já devolvemos o valor pelo Mercado Pago. Quando quiser, é só agendar de novo: ${env.webOrigin}`;
      await this.messaging.send({ businessId: a.businessId, appointmentId: a.id, customerId: a.customerId, phone: a.customer.whatsapp, kind: 'payment', text });
    } catch (error) {
      this.logger.warn(`Não foi possível avisar o cliente sobre o Pix: ${(error as Error).message}`);
    }
  }

  /**
   * Notificação do Mercado Pago (Orders API, type=order): nunca confiamos no corpo — consultamos
   * a order na API com o token do negócio dono da cobrança.
   */
  async handleNotification(orderId: string): Promise<'paid' | 'canceled' | 'ignored'> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerPaymentId: orderId },
      include: { appointment: { include: { business: true } } },
    });
    if (!payment || payment.provider !== 'MERCADO_PAGO') return 'ignored';
    const token = this.accessTokenFor(payment.appointment.business);
    if (!token) return 'ignored';
    const { status, externalReference } = await this.mp.getStatus(token, orderId);
    if (externalReference && externalReference !== payment.appointmentId) return 'ignored';
    if (status === 'processed') {
      await this.markPaid(payment);
      return 'paid';
    }
    // canceled (cancelada/expirada) ou failed (recusada/expirada)
    if ((status === 'canceled' || status === 'failed') && payment.status === 'PENDING') {
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

  /** Cancela a cobrança pendente quando o agendamento é cancelado (e a order no Mercado Pago). */
  async cancelPendingFor(appointmentId: string): Promise<void> {
    const pending = await this.prisma.payment.findMany({ where: { appointmentId, status: 'PENDING' }, select: { id: true } });
    for (const p of pending) {
      const claimed = await this.prisma.payment.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: 'CANCELED' } });
      if (claimed.count) await this.cancelAtProvider(p.id);
    }
  }

  /**
   * Cancela a order no Mercado Pago para o QR Code parar de aceitar pagamento (o Pix do MP dura no
   * mínimo 30 min, às vezes mais que a reserva). Melhor esforço: se falhar, um pagamento tardio
   * ainda é tratado por markPaid (reativa ou estorna).
   */
  private async cancelAtProvider(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { appointment: { include: { business: true } } } });
    if (!payment || payment.provider !== 'MERCADO_PAGO' || !payment.providerPaymentId) return;
    const token = this.accessTokenFor(payment.appointment.business);
    if (!token) return;
    try {
      await this.mp.cancel(token, payment.providerPaymentId, `cancel-${payment.id}`);
    } catch (error) {
      this.logger.warn(`Não foi possível cancelar a order ${payment.providerPaymentId} no Mercado Pago: ${(error as Error).message}`);
    }
  }
}
