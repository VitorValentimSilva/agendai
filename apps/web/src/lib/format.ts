import { TZDate } from "@date-fns/tz";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const DEFAULT_TZ = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPrice(cents: number): string {
  return brl.format(cents / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Formata um instante (ISO/Date) no fuso do negócio. */
export function formatInTz(value: string | Date, pattern: string, timezone = DEFAULT_TZ): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(new TZDate(date.getTime(), timezone), pattern, { locale: ptBR });
}

export const formatTime = (v: string | Date, tz?: string) => formatInTz(v, "HH:mm", tz);
export const formatDateLong = (v: string | Date, tz?: string) => formatInTz(v, "EEEE, d 'de' MMMM", tz);
export const formatDateShort = (v: string | Date, tz?: string) => formatInTz(v, "dd/MM/yyyy", tz);

/** "2026-11-04" → "quarta-feira, 4 de novembro" (data de calendário, sem fuso). */
export function formatLocalDate(date: string, pattern = "EEEE, d 'de' MMMM"): string {
  const [y, m, d] = date.split("-").map(Number);
  return format(new Date(y!, m! - 1, d!), pattern, { locale: ptBR });
}

/** Date local do navegador ↔ "AAAA-MM-DD" (para o calendário). */
export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
export function fromIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** "Hoje" no fuso do negócio, como AAAA-MM-DD. */
export function todayInTz(timezone = DEFAULT_TZ): string {
  return format(new TZDate(Date.now(), timezone), "yyyy-MM-dd");
}

export function minutesToHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

/** Minutos desde 00:00 de um instante, no fuso do negócio. */
export function minutesInTz(value: string | Date, timezone = DEFAULT_TZ): number {
  const date = typeof value === "string" ? parseISO(value) : value;
  const z = new TZDate(date.getTime(), timezone);
  return z.getHours() * 60 + z.getMinutes();
}

/** Data (AAAA-MM-DD) de um instante no fuso do negócio. */
export function isoDateInTz(value: string | Date, timezone = DEFAULT_TZ): string {
  return formatInTz(value, "yyyy-MM-dd", timezone);
}

export function addDaysIso(date: string, days: number): string {
  const d = fromIsoDate(date);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Segunda-feira da semana da data. */
export function startOfWeekIso(date: string): string {
  const d = fromIsoDate(date);
  const diff = (d.getDay() + 6) % 7;
  return addDaysIso(date, -diff);
}
