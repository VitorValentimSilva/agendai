import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BadRequestException } from '@nestjs/common';
import { parseLocalDate, type LocalDate } from '../availability/availability.engine.js';

export function parseDateParam(value: string, name = 'date'): LocalDate {
  try {
    return parseLocalDate(value);
  } catch {
    throw new BadRequestException(`Parâmetro "${name}" deve estar no formato AAAA-MM-DD.`);
  }
}

/** "terça-feira, 3 de novembro às 09:00" no fuso do negócio. */
export function formatLongDateTime(instant: Date, timezone: string): string {
  return format(new TZDate(instant.getTime(), timezone), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

export function formatTime(instant: Date, timezone: string): string {
  return format(new TZDate(instant.getTime(), timezone), 'HH:mm');
}

export function formatIsoDate(instant: Date, timezone: string): string {
  return format(new TZDate(instant.getTime(), timezone), 'yyyy-MM-dd');
}
