import type { AppointmentWithRelations } from '../appointments/appointment.mapper.js';
import type { GoogleEventBody } from './google.client.js';
import { STATUS_LABELS } from '../appointments/status-rules.js';

/** Evento do Google Calendar a partir do agendamento (função pura, testada). */
export function googleEventFor(
  a: AppointmentWithRelations,
  business: { name: string; timezone: string; addressLine: string; city: string; state: string },
): GoogleEventBody {
  return {
    summary: `${a.service.name} — ${a.customer.name}`,
    description: [
      `Cliente: ${a.customer.name}`,
      `WhatsApp: +${a.customer.whatsapp}`,
      `Status: ${STATUS_LABELS[a.status]}`,
      `Código: ${a.code}`,
      ...(a.notes ? [`Observações: ${a.notes}`] : []),
      '',
      `Agendado pelo Agendaí — ${business.name}`,
    ].join('\n'),
    location: `${business.addressLine}, ${business.city} - ${business.state}`,
    start: { dateTime: a.startsAt.toISOString(), timeZone: business.timezone },
    end: { dateTime: a.endsAt.toISOString(), timeZone: business.timezone },
    status: a.status === 'PENDING_PAYMENT' ? 'tentative' : 'confirmed',
    extendedProperties: { private: { agendaiAppointmentId: a.id } },
  };
}
