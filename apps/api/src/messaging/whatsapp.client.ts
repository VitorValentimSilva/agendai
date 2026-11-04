import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { env } from '../common/env.js';

export type WhatsAppProviderName = 'WHATSAPP_CLOUD' | 'SIMULATED';

export interface TemplateMessage {
  name: string;
  /** Parâmetros {{1}}, {{2}}... do corpo do template */
  bodyParams: string[];
  /** Payloads dos botões de resposta rápida, na ordem do template */
  quickReplyPayloads?: string[];
}

export interface SendResult {
  provider: WhatsAppProviderName;
  messageId: string;
}

/**
 * Cliente da WhatsApp Cloud API (Meta). Sem WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID,
 * funciona em modo SIMULADO: nada sai, mas tudo é registrado como se tivesse sido enviado
 * (útil para a demonstração e para testes).
 */
@Injectable()
export class WhatsAppClient {
  private readonly logger = new Logger(WhatsAppClient.name);

  get provider(): WhatsAppProviderName {
    return env.whatsappToken && env.whatsappPhoneNumberId ? 'WHATSAPP_CLOUD' : 'SIMULATED';
  }

  get isSimulated(): boolean {
    return this.provider === 'SIMULATED';
  }

  async sendText(to: string, body: string): Promise<SendResult> {
    return this.send({ to, type: 'text', text: { body, preview_url: true } });
  }

  async sendTemplate(to: string, template: TemplateMessage): Promise<SendResult> {
    const components: unknown[] = [
      { type: 'body', parameters: template.bodyParams.map((text) => ({ type: 'text', text })) },
      ...(template.quickReplyPayloads ?? []).map((payload, index) => ({
        type: 'button',
        sub_type: 'quick_reply',
        index: String(index),
        parameters: [{ type: 'payload', payload }],
      })),
    ];
    return this.send({
      to,
      type: 'template',
      template: { name: template.name, language: { code: env.whatsappTemplateLang }, components },
    });
  }

  private async send(message: Record<string, unknown>): Promise<SendResult> {
    if (this.isSimulated) {
      return { provider: 'SIMULATED', messageId: `sim_${randomBytes(8).toString('hex')}` };
    }
    const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.whatsappToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message?: string } };
    if (!res.ok || !data.messages?.[0]?.id) {
      const reason = data.error?.message ?? `HTTP ${res.status}`;
      this.logger.warn(`WhatsApp recusou a mensagem: ${reason}`);
      throw new Error(`WhatsApp: ${reason}`);
    }
    return { provider: 'WHATSAPP_CLOUD', messageId: data.messages[0].id };
  }
}
