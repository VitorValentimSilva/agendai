import { createHmac } from 'node:crypto';
import { safeEqual } from '../common/crypto.js';

export type PaymentMode = 'NONE' | 'DEPOSIT' | 'FULL';

/** Valor a cobrar no Pix (centavos). 0 = não cobra. Sinal arredondado para cima. */
export function amountToCharge(priceCents: number, mode: PaymentMode, depositPercent: number): number {
  if (mode === 'NONE' || priceCents <= 0) return 0;
  if (mode === 'FULL') return priceCents;
  const pct = Math.min(100, Math.max(1, depositPercent));
  return Math.max(1, Math.ceil((priceCents * pct) / 100));
}

/**
 * Valida o header x-signature das notificações do Mercado Pago:
 * "ts=<timestamp>,v1=<hmac>", com HMAC-SHA256 do manifesto
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" usando a chave secreta.
 */
export function validMercadoPagoSignature(args: {
  signature: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
  secret: string;
  now?: Date;
  toleranceSeconds?: number;
}): boolean {
  if (!args.signature || !args.dataId) return false;
  const parts = Object.fromEntries(
    args.signature.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=');
      return [k, v.join('=')];
    }),
  ) as Record<string, string>;
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  // Rejeita notificações velhas (replay). O ts do Mercado Pago vem em milissegundos.
  const tolerance = args.toleranceSeconds ?? 15 * 60;
  const tsMs = ts.length > 11 ? Number(ts) : Number(ts) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs((args.now ?? new Date()).getTime() - tsMs) > tolerance * 1000) return false;

  const id = /^[a-z0-9]+$/i.test(args.dataId) ? args.dataId.toLowerCase() : args.dataId;
  let manifest = `id:${id};`;
  if (args.requestId) manifest += `request-id:${args.requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac('sha256', args.secret).update(manifest).digest('hex');
  return safeEqual(v1, expected);
}
