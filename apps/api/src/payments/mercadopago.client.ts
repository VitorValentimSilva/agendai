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
  description: string;
  payerEmail: string;
  payerFirstName: string;
  externalReference: string;
  expiresAt: Date;
  notificationUrl: string | null;
  idempotencyKey: string;
}

export type ProviderPaymentStatus = 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back' | string;

/** Cliente mínimo da API de pagamentos do Mercado Pago (Pix). */
@Injectable()
export class MercadoPagoClient {
  private readonly logger = new Logger(MercadoPagoClient.name);
  private readonly base = 'https://api.mercadopago.com';

  async createPix(input: CreatePixInput): Promise<PixCharge> {
    const res = await fetch(`${this.base}/v1/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: input.amountCents / 100,
        description: input.description.slice(0, 250),
        payment_method_id: 'pix',
        external_reference: input.externalReference,
        date_of_expiration: input.expiresAt.toISOString().replace('Z', '-00:00'),
        ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
        payer: { email: input.payerEmail, first_name: input.payerFirstName },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: number;
      message?: string;
      point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
    };
    const tx = data.point_of_interaction?.transaction_data;
    if (!res.ok || !data.id || !tx?.qr_code) {
      this.logger.warn(`Mercado Pago recusou a cobrança: ${data.message ?? res.status}`);
      throw new Error(`Mercado Pago: ${data.message ?? `HTTP ${res.status}`}`);
    }
    return {
      providerPaymentId: String(data.id),
      qrCode: tx.qr_code,
      qrCodeBase64: tx.qr_code_base64 ?? null,
      ticketUrl: tx.ticket_url ?? null,
    };
  }

  async getStatus(accessToken: string, providerPaymentId: string): Promise<{ status: ProviderPaymentStatus; externalReference: string | null }> {
    const res = await fetch(`${this.base}/v1/payments/${encodeURIComponent(providerPaymentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; external_reference?: string; message?: string };
    if (!res.ok || !data.status) throw new Error(`Mercado Pago: ${data.message ?? `HTTP ${res.status}`}`);
    return { status: data.status, externalReference: data.external_reference ?? null };
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
