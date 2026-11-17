import type { Business } from '@prisma/client';
import type { BusinessSettingsDto } from './admin.dto.js';

/** Nunca devolve tokens do Mercado Pago (nem cifrados) — só se existem e como foram conectados. */
export function toSettings(b: Business): BusinessSettingsDto {
  const {
    createdAt: _c,
    updatedAt: _u,
    mercadoPagoTokenEnc,
    mercadoPagoRefreshTokenEnc: _r,
    mercadoPagoTokenExpiresAt,
    mercadoPagoUserId,
    mercadoPagoConnectedVia,
    ...rest
  } = b;
  return {
    ...rest,
    hasMercadoPagoToken: Boolean(mercadoPagoTokenEnc),
    mercadoPago: {
      connected: Boolean(mercadoPagoTokenEnc),
      via: mercadoPagoTokenEnc ? (mercadoPagoConnectedVia === 'OAUTH' ? 'OAUTH' : 'MANUAL') : null,
      userId: mercadoPagoUserId,
      expiresAt: mercadoPagoTokenExpiresAt?.toISOString() ?? null,
    },
  };
}
