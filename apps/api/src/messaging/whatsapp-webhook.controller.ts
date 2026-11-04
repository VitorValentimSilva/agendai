import { Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac } from 'node:crypto';
import { env } from '../common/env.js';
import { safeEqual } from '../common/crypto.js';
import { MessagingService } from './messaging.service.js';

interface WebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          text?: { body?: string };
          button?: { payload?: string; text?: string };
          interactive?: { button_reply?: { id?: string; title?: string } };
        }>;
      };
    }>;
  }>;
}

/** Valida X-Hub-Signature-256 = sha256=HMAC(app secret, corpo bruto). */
export function validMetaSignature(rawBody: Buffer | undefined, header: string | undefined, secret: string): boolean {
  if (!rawBody || !header?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return safeEqual(header, expected);
}

@ApiExcludeController()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly messaging: MessagingService) {}

  /** Verificação do webhook pela Meta (hub.challenge). */
  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    if (mode === 'subscribe' && env.whatsappVerifyToken && token && safeEqual(token, env.whatsappVerifyToken)) {
      return challenge ?? '';
    }
    throw new ForbiddenException();
  }

  /** Mensagens recebidas (respostas dos clientes). */
  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature?: string) {
    const secret = env.whatsappAppSecret;
    if (!secret) throw new ServiceUnavailableException('Webhook do WhatsApp não configurado (WHATSAPP_APP_SECRET).');
    if (!validMetaSignature(req.rawBody, signature, secret)) throw new UnauthorizedException('Assinatura inválida.');

    const body = req.body as WebhookBody;
    let handled = 0;
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          const result = await this.messaging.handleInbound({
            from: msg.from,
            text: msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title,
            buttonPayload: msg.button?.payload ?? msg.interactive?.button_reply?.id,
            providerMessageId: msg.id,
          });
          if (result.handled) handled++;
        }
      }
    }
    // A Meta só precisa de 200; o resumo ajuda a depurar.
    return { received: true, handled };
  }
}
