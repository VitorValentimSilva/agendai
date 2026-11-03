import { TZDate } from "@date-fns/tz";
import { minutesToHHMM } from "./format";

type Opening = Array<{ weekday: number; intervals: Array<{ start: number; end: number }> }>;

export function describeIntervals(intervals: Array<{ start: number; end: number }>): string {
  if (intervals.length === 0) return "Fechado";
  return intervals.map((i) => `${minutesToHHMM(i.start)}–${minutesToHHMM(i.end)}`).join(" · ");
}

/** Situação atual no fuso do negócio: aberto agora? */
export function openStatus(opening: Opening, timezone: string, now = new Date()): { open: boolean; label: string } {
  const z = new TZDate(now.getTime(), timezone);
  const weekday = z.getDay();
  const minute = z.getHours() * 60 + z.getMinutes();
  const today = opening.find((o) => o.weekday === weekday)?.intervals ?? [];
  const current = today.find((i) => minute >= i.start && minute < i.end);
  if (current) return { open: true, label: `Aberto agora · fecha às ${minutesToHHMM(current.end)}` };
  const later = today.find((i) => i.start > minute);
  if (later) return { open: false, label: `Fechado agora · abre às ${minutesToHHMM(later.start)}` };
  for (let i = 1; i <= 7; i++) {
    const wd = (weekday + i) % 7;
    const next = opening.find((o) => o.weekday === wd)?.intervals[0];
    if (next) {
      const day = i === 1 ? "amanhã" : ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][wd];
      return { open: false, label: `Fechado agora · abre ${day} às ${minutesToHHMM(next.start)}` };
    }
  }
  return { open: false, label: "Fechado" };
}

export function weekdayInTz(timezone: string, now = new Date()): number {
  return new TZDate(now.getTime(), timezone).getDay();
}
