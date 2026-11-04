import { Injectable, Logger } from '@nestjs/common';
import type { AppointmentWithRelations } from './appointment.mapper.js';

/** `slot-freed`: o horário antigo de uma remarcação ficou livre (o agendamento continua ativo). */
export type AppointmentEvent = 'created' | 'rescheduled' | 'status-changed' | 'canceled' | 'slot-freed';

/** Reage a mudanças em agendamentos (fila de espera, Google Calendar...). */
export interface AppointmentListener {
  onAppointmentEvent(event: AppointmentEvent, appointment: AppointmentWithRelations): Promise<void>;
}

/**
 * Barramento simples de eventos de agendamento. Os ouvintes são aguardados (em serverless,
 * trabalho "solto" pode ser interrompido quando a resposta termina), mas uma falha num ouvinte
 * nunca derruba a operação principal — só é registrada no log.
 */
@Injectable()
export class AppointmentEvents {
  private readonly logger = new Logger(AppointmentEvents.name);
  private readonly listeners: AppointmentListener[] = [];

  register(listener: AppointmentListener): void {
    this.listeners.push(listener);
  }

  async emit(event: AppointmentEvent, appointment: AppointmentWithRelations): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener.onAppointmentEvent(event, appointment);
      } catch (error) {
        this.logger.error(`Falha ao processar evento "${event}" do agendamento ${appointment.id}`, error as Error);
      }
    }
  }
}
