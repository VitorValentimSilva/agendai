import { parseLocalDate, localDayRange, type TimeRange } from '../availability/availability.engine.js';
import type { GoogleListedEvent } from './google.client.js';

/**
 * Converte eventos do Google em intervalos ocupados (função pura, testada).
 * Ignora: eventos do próprio Agendaí (já contam como agendamento), cancelados, marcados como
 * "Disponível" (transparent) e convites recusados. Dia inteiro ocupa o dia no fuso do negócio.
 */
export function busyFromGoogleEvents(events: GoogleListedEvent[], timezone: string): TimeRange[] {
  const busy: TimeRange[] = [];
  for (const e of events) {
    if (e.status === 'cancelled' || e.transparency === 'transparent') continue;
    if (e.extendedProperties?.private?.agendaiAppointmentId) continue;
    if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue;
    if (e.start?.dateTime && e.end?.dateTime) {
      const start = new Date(e.start.dateTime);
      const end = new Date(e.end.dateTime);
      if (!Number.isNaN(start.getTime()) && end > start) busy.push({ start, end });
    } else if (e.start?.date && e.end?.date) {
      try {
        // end.date é exclusivo no Google
        busy.push({ start: localDayRange(parseLocalDate(e.start.date), timezone).start, end: localDayRange(parseLocalDate(e.end.date), timezone).start });
      } catch {
        // data malformada: ignora
      }
    }
  }
  return busy;
}
