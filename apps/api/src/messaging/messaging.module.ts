import { Global, Module } from '@nestjs/common';
import { WhatsAppClient } from './whatsapp.client.js';
import { MessagingService } from './messaging.service.js';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller.js';

@Global()
@Module({
  providers: [WhatsAppClient, MessagingService],
  controllers: [WhatsAppWebhookController],
  exports: [WhatsAppClient, MessagingService],
})
export class MessagingModule {}
