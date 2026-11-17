import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

export interface PixCharge {
  providerPaymentId: string;
  qrCode: string;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
}

export interface CreatePixInput {
  accessToken: string;
  amountCents: number;
  payerEmail: string;
  payerFirstName: string;
  externalReference: string;
  /** Validade do Pix no Mercado Pago (mínimo 30 min, exigência da API). */
  expirationMinutes: number;
  idempotencyKey: string;
}

/**
 * Status da order (Orders API): created, action_required, processing, processed, canceled, failed,
 * refunded, charged_back. status_detail traz o detalhe (ex.: waiting_transfer, accredited, expired).
 */
export interface OrderStatus {
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
}

const money = (cents: number) => (cents / 100).toFixed(2);

/**
 * Cliente mínimo da Orders API do Mercado Pago (Checkout Transparente) para Pix.
 * A Payments API (/v1/payments) está sendo descontinuada; o webhook é configurado no painel
 * (evento "Order") e as notificações chegam com type=order.
 */
@Injectable()
export class MercadoPagoClient {
  private readonly logger = new Logger(MercadoPagoClient.name);
  private readonly base = 'https://api.mercadopago.com';

  async createPix(input: CreatePixInput): Promise<PixCharge> {
    const minutes = Math.min(Math.max(Math.ceil(input.expirationMinutes), 30), 30 * 24 * 60);
    const res = await fetch(`${this.base}/v1/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        type: 'online',
        processing_mode: 'automatic',
        total_amount: money(input.amountCents),
        external_reference: input.externalReference,
        payer: { email: input.payerEmail, first_name: input.payerFirstName },
        transactions: {
          payments: [
            {
              amount: money(input.amountCents),
              payment_method: { id: 'pix', type: 'bank_transfer' },
              expiration_time: `PT${minutes}M`,
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      errors?: Array<{ message?: string }>;
      transactions?: { payments?: Array<{ payment_method?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } }> };
    };
    const pm = data.transactions?.payments?.[0]?.payment_method;
    if (!res.ok || !data.id || !pm?.qr_code) {
      const reason = data.errors?.[0]?.message ?? data.message ?? `HTTP ${res.status}`;
      this.logger.warn(`Mercado Pago recusou a order Pix: ${reason}`);
      throw new Error(`Mercado Pago: ${reason}`);
    }
    return {
      providerPaymentId: data.id,
      qrCode: pm.qr_code,
      qrCodeBase64: pm.qr_code_base64 ?? null,
      ticketUrl: pm.ticket_url ?? null,
    };
  }

  async getStatus(accessToken: string, orderId: string): Promise<OrderStatus> {
    const res = await fetch(`${this.base}/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: string;
      status_detail?: string;
      external_reference?: string;
      message?: string;
    };
    if (!res.ok || !data.status) throw new Error(`Mercado Pago: ${data.message ?? `HTTP ${res.status}`}`);
    return { status: data.status, statusDetail: data.status_detail ?? null, externalReference: data.external_reference ?? null };
  }

  /** Reembolso total (POST /v1/orders/{id}/refund com body vazio). */
  async refund(accessToken: string, orderId: string, idempotencyKey: string): Promise<void> {
    await this.postAction(accessToken, orderId, 'refund', idempotencyKey);
  }

  /** Cancela uma order ainda não paga (status created/action_required). */
  async cancel(accessToken: string, orderId: string, idempotencyKey: string): Promise<void> {
    await this.postAction(accessToken, orderId, 'cancel', idempotencyKey);
  }

  private async postAction(accessToken: string, orderId: string, action: 'refund' | 'cancel', idempotencyKey: string): Promise<void> {
    const res = await fetch(`${this.base}/v1/orders/${encodeURIComponent(orderId)}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Idempotency-Key': idempotencyKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; errors?: Array<{ message?: string }> };
      throw new Error(`Mercado Pago (${action === 'refund' ? 'estorno' : 'cancelamento'}): ${data.errors?.[0]?.message ?? data.message ?? `HTTP ${res.status}`}`);
    }
  }

  /** Cobrança fictícia para o modo simulado (o QR é desenhado no site a partir do texto). */
  simulatedPix(amountCents: number, reference: string): PixCharge {
    const id = `sim_${randomBytes(6).toString('hex')}`;
    const value = (amountCents / 100).toFixed(2);
    return {
      providerPaymentId: id,
      qrCode: `00020126580014br.gov.bcb.pix0136agendai-demo-${reference.slice(0, 8)}5204000053039865406${value}5802BR5913AGENDAI DEMO6009CAMPINAS62070503***6304SIMU`,
      qrCodeBase64: null,
      ticketUrl: null,
    };
  }
}
