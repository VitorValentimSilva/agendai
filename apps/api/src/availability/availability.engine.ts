/**
 * Motor de disponibilidade — funções PURAS (sem banco, sem relógio global).
 *
 * Toda entrada de data/hora absoluta está em UTC (objetos Date). As regras
 * (expediente, "hoje", limite de dias) são avaliadas no fuso do negócio.
 */
import { TZDate } from '@date-fns/tz';

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface WorkingInterval {
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
  /** minutos desde 00:00 no fuso do negócio */
  startMinute: number;
  endMinute: number;
}

export interface ProfessionalSchedule {
  professionalId: string;
  workingHours: WorkingInterval[];
  /** Períodos ocupados: agendamentos não cancelados e bloqueios (do profissional ou do negócio). */
  busy: TimeRange[];
}

export interface SlotRules {
  timezone: string;
  slotIntervalMinutes: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
}

export interface Slot {
  start: Date;
  end: Date;
}

export interface AnySlot extends Slot {
  professionalIds: string[];
}

export interface LocalDate {
  year: number;
  month: number; // 1-12
  day: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MINUTE_MS = 60_000;

export function parseLocalDate(date: string): LocalDate {
  const match = DATE_RE.exec(date);
  if (!match) throw new Error(`Data inválida: ${date}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Data inválida: ${date}`);
  }
  return { year, month, day };
}

export function formatLocalDate({ year, month, day }: LocalDate): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Dia da semana de uma data de calendário (independe de fuso). */
export function weekdayOf(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

/** Número de dias entre duas datas de calendário (b - a). */
export function diffInCalendarDays(a: LocalDate, b: LocalDate): number {
  const ta = Date.UTC(a.year, a.month - 1, a.day);
  const tb = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((tb - ta) / 86_400_000);
}

export function addCalendarDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Data de calendário de um instante no fuso informado. */
export function toLocalDate(instant: Date, timezone: string): LocalDate {
  const z = new TZDate(instant.getTime(), timezone);
  return { year: z.getFullYear(), month: z.getMonth() + 1, day: z.getDate() };
}

/** Instante UTC correspondente a "data local + minutos desde 00:00" no fuso. */
export function localMinuteToInstant(date: LocalDate, minute: number, timezone: string): Date {
  const z = new TZDate(date.year, date.month - 1, date.day, Math.floor(minute / 60), minute % 60, 0, timezone);
  return new Date(z.getTime());
}

/** [00:00, 24:00) do dia local, em UTC. */
export function localDayRange(date: LocalDate, timezone: string): TimeRange {
  return {
    start: localMinuteToInstant(date, 0, timezone),
    end: localMinuteToInstant(addCalendarDays(date, 1), 0, timezone),
  };
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/** A data está dentro da janela permitida para agendamento (hoje .. hoje + maxAdvanceDays)? */
export function isWithinBookingWindow(date: LocalDate, rules: SlotRules, now: Date): boolean {
  const today = toLocalDate(now, rules.timezone);
  const diff = diffInCalendarDays(today, date);
  return diff >= 0 && diff <= rules.maxAdvanceDays;
}

export interface ComputeSlotsInput {
  date: LocalDate;
  rules: SlotRules;
  durationMinutes: number;
  schedule: ProfessionalSchedule;
  now: Date;
}

/** Horários livres de UM profissional em uma data local. */
export function computeProfessionalSlots({ date, rules, durationMinutes, schedule, now }: ComputeSlotsInput): Slot[] {
  if (durationMinutes <= 0 || rules.slotIntervalMinutes <= 0) return [];
  if (!isWithinBookingWindow(date, rules, now)) return [];

  const weekday = weekdayOf(date);
  const earliest = now.getTime() + rules.minAdvanceMinutes * MINUTE_MS;
  const intervals = schedule.workingHours
    .filter((w) => w.weekday === weekday)
    .sort((a, b) => a.startMinute - b.startMinute);

  const slots: Slot[] = [];
  const seen = new Set<number>();

  for (const interval of intervals) {
    for (
      let minute = interval.startMinute;
      minute + durationMinutes <= interval.endMinute;
      minute += rules.slotIntervalMinutes
    ) {
      const start = localMinuteToInstant(date, minute, rules.timezone);
      const end = new Date(start.getTime() + durationMinutes * MINUTE_MS);
      if (start.getTime() < earliest) continue;
      if (seen.has(start.getTime())) continue;
      const candidate = { start, end };
      if (schedule.busy.some((b) => overlaps(candidate, b))) continue;
      seen.add(start.getTime());
      slots.push(candidate);
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** "Qualquer profissional": união dos horários, indicando quem está livre em cada um. */
export function computeAnySlots(
  input: Omit<ComputeSlotsInput, 'schedule'> & { schedules: ProfessionalSchedule[] },
): AnySlot[] {
  const byStart = new Map<number, AnySlot>();
  for (const schedule of input.schedules) {
    for (const slot of computeProfessionalSlots({ ...input, schedule })) {
      const key = slot.start.getTime();
      const existing = byStart.get(key);
      if (existing) existing.professionalIds.push(schedule.professionalId);
      else byStart.set(key, { ...slot, professionalIds: [schedule.professionalId] });
    }
  }
  return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Escolhe o profissional para "qualquer um": o livre com menos agendamentos no dia.
 * Empate: mantém a ordem recebida (ordem de exibição), para ser determinístico.
 */
export function pickLeastBusyProfessional(
  candidateIds: string[],
  appointmentsCountByProfessional: Record<string, number>,
): string[] {
  return candidateIds
    .map((id, index) => ({ id, index, count: appointmentsCountByProfessional[id] ?? 0 }))
    .sort((a, b) => a.count - b.count || a.index - b.index)
    .map((c) => c.id);
}
