import { createHmac } from 'node:crypto';
import { amountToCharge, validMercadoPagoSignature } from './payment-rules.js';

describe('amountToCharge', () => {
  it('não cobra quando desativado ou serviço gratuito', () => {
    expect(amountToCharge(5000, 'NONE', 30)).toBe(0);
    expect(amountToCharge(0, 'FULL', 30)).toBe(0);
  });
  it('cobra total ou sinal (arredondado para cima)', () => {
    expect(amountToCharge(5500, 'FULL', 30)).toBe(5500);
    expect(amountToCharge(5500, 'DEPOSIT', 30)).toBe(1650);
    expect(amountToCharge(3333, 'DEPOSIT', 10)).toBe(334);
    expect(amountToCharge(100, 'DEPOSIT', 0)).toBe(1); // mínimo 1%
  });
});

describe('validMercadoPagoSignature', () => {
  const secret = 'segredo-mp';
  const now = new Date('2026-11-04T12:00:00Z');
  const ts = String(now.getTime());
  const sign = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex');

  it('aceita assinatura correta', () => {
    const v1 = sign(`id:123456;request-id:req-1;ts:${ts};`);
    expect(validMercadoPagoSignature({ signature: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: '123456', secret, now })).toBe(true);
  });

  it('recusa assinatura errada, sem dados ou antiga (replay)', () => {
    const v1 = sign(`id:123456;request-id:req-1;ts:${ts};`);
    expect(validMercadoPagoSignature({ signature: `ts=${ts},v1=${v1}`, requestId: 'req-2', dataId: '123456', secret, now })).toBe(false);
    expect(validMercadoPagoSignature({ signature: undefined, requestId: 'r', dataId: '1', secret, now })).toBe(false);
    const old = new Date(now.getTime() + 60 * 60_000);
    expect(validMercadoPagoSignature({ signature: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: '123456', secret, now: old })).toBe(false);
  });
});
