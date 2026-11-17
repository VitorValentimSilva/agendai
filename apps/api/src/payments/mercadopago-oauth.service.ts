import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service.js';
import { env } from '../common/env.js';
import { encryptSecret } from '../common/crypto.js';
import type { SessionUser } from '../common/decorators.js';
import { MercadoPagoClient } from './mercadopago.client.js';
import { PaymentsService } from './payments.service.js';

export const MP_STATE_AUDIENCE = 'agendai:mp-state';

interface MercadoPagoState {
  purpose: 'mp-connect';
  bid: string;
  uid: string;
}

/**
 * "Conectar Mercado Pago": o dono do negócio autoriza a aplicação da plataforma (OAuth, Authorization code).
 * O Pix passa a ser criado em nome da conta dele (o dinheiro cai lá) e as notificações chegam pela aplicação
 * da plataforma — um webhook e uma assinatura só para todos os negócios.
 */
@Injectable()
export class MercadoPagoOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mp: MercadoPagoClient,
    private readonly payments: PaymentsService,
  ) {}

  async connectUrl(user: SessionUser): Promise<string> {
    if (!env.mpOAuthEnabled) {
      throw new ServiceUnavailableException('Conexão com o Mercado Pago não configurada na plataforma (MP_CLIENT_ID/SECRET).');
    }
    const state = await this.jwt.signAsync({ purpose: 'mp-connect', bid: user.businessId, uid: user.userId } satisfies MercadoPagoState, {
      expiresIn: 600,
      audience: MP_STATE_AUDIENCE,
    });
    return this.mp.oauthUrl(state);
  }

  /** Retorno do Mercado Pago: troca o code pelos tokens e guarda cifrados no negócio. */
  async callback(code: string, state: string): Promise<void> {
    let payload: MercadoPagoState;
    try {
      payload = await this.jwt.verifyAsync<MercadoPagoState>(state, { audience: MP_STATE_AUDIENCE });
    } catch {
      throw new ForbiddenException('Link de conexão expirado. Tente de novo pelo painel.');
    }
    if (payload.purpose !== 'mp-connect') throw new ForbiddenException();
    // Só o dono atual do negócio pode concluir a conexão
    const owner = await this.prisma.user.findFirst({ where: { id: payload.uid, businessId: payload.bid, role: 'OWNER' } });
    if (!owner) throw new NotFoundException('Negócio não encontrado.');
    const tokens = await this.mp.exchangeCode(code);
    await this.prisma.business.update({
      where: { id: payload.bid },
      data: {
        mercadoPagoTokenEnc: encryptSecret(tokens.accessToken),
        mercadoPagoRefreshTokenEnc: encryptSecret(tokens.refreshToken),
        mercadoPagoTokenExpiresAt: tokens.expiresAt,
        mercadoPagoUserId: tokens.userId,
        mercadoPagoConnectedVia: 'OAUTH',
      },
    });
  }

  /** Desconecta a conta. Sem conta (e fora da demo), a cobrança Pix é desligada. */
  async disconnect(user: SessionUser) {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: user.businessId } });
    return this.prisma.business.update({
      where: { id: business.id },
      data: {
        mercadoPagoTokenEnc: null,
        mercadoPagoRefreshTokenEnc: null,
        mercadoPagoTokenExpiresAt: null,
        mercadoPagoUserId: null,
        mercadoPagoConnectedVia: null,
        ...(!env.mpAccessToken && !this.payments.canSimulate(business) ? { paymentMode: 'NONE' as const } : {}),
      },
    });
  }
}
