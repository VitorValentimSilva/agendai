import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { AppointmentEvents } from '../appointments/appointment-events.js';
import { MercadoPagoClient } from './mercadopago.client.js';
import { PaymentsService } from './payments.service.js';
import { MercadoPagoWebhookController } from './mercadopago-webhook.controller.js';
import { MercadoPagoOAuthService } from './mercadopago-oauth.service.js';
import { MercadoPagoOAuthAdminController, MercadoPagoOAuthCallbackController } from './mercadopago-oauth.controller.js';

@Global()
@Module({
  providers: [MercadoPagoClient, PaymentsService, MercadoPagoOAuthService],
  controllers: [MercadoPagoWebhookController, MercadoPagoOAuthCallbackController, MercadoPagoOAuthAdminController],
  exports: [PaymentsService, MercadoPagoClient],
})
export class PaymentsModule implements OnModuleInit {
  constructor(
    private readonly events: AppointmentEvents,
    private readonly payments: PaymentsService,
  ) {}

  /** Agendamento cancelado (por qualquer caminho) → cobrança pendente é cancelada. */
  onModuleInit(): void {
    this.events.register({
      onAppointmentEvent: async (event, appointment) => {
        if (event === 'canceled') await this.payments.cancelPendingFor(appointment.id);
      },
    });
  }
}
