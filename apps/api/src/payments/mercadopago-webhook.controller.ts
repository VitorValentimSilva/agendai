import { Body, Controller, Headers, HttpCode, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { env } from '../common/env.js';
import { PaymentsService } from './payments.service.js';
import { validMercadoPagoSignature } from './payment-rules.js';

interface MercadoPagoNotification {
  type?: string;
  action?: string;
  data?: { id?: string | number };
}

@ApiExcludeController()
@Controller('webhooks/mercadopago')
export class MercadoPagoWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @HttpCode(200)
  async receive(
    @Body() body: MercadoPagoNotification,
    @Query('data.id') queryDataId?: string,
    @Query('type') queryType?: string,
    @Headers('x-signature') signature?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const dataId = String(queryDataId ?? body?.data?.id ?? '');
    const type = queryType ?? body?.type;
    // Com a chave configurada, a assinatura é obrigatória. Sem ela, seguimos mesmo assim porque
    // o status é sempre consultado na API do Mercado Pago (uma notificação forjada não muda nada).
    if (env.mpWebhookSecret && !validMercadoPagoSignature({ signature, requestId, dataId, secret: env.mpWebhookSecret })) {
      throw new UnauthorizedException('Assinatura inválida.');
    }
    if (type !== 'payment' || !dataId) return { received: true, result: 'ignored' };
    const result = await this.payments.handleNotification(dataId);
    return { received: true, result };
  }
}
