/** Relatório por período — função pura (testada). */
import type { AppointmentStatus } from '@prisma/client';

export interface ReportRow {
  status: AppointmentStatus;
  priceCents: number;
  professionalId: string;
  professionalName: string;
  commissionPercent: number;
  serviceId: string;
  serviceName: string;
}

export interface ProfessionalReport {
  professionalId: string;
  professionalName: string;
  commissionPercent: number;
  appointments: number;
  completed: number;
  noShows: number;
  canceled: number;
  revenueCents: number;
  commissionCents: number;
  averageTicketCents: number;
}

export interface ServiceReport {
  serviceId: string;
  serviceName: string;
  completed: number;
  revenueCents: number;
}

export interface ReportTotals {
  appointments: number;
  completed: number;
  noShows: number;
  canceled: number;
  revenueCents: number;
  commissionCents: number;
  /** Receita menos comissões */
  netRevenueCents: number;
}

/** Comissão arredondada ao centavo. */
export const commissionOf = (revenueCents: number, percent: number) => Math.round((revenueCents * percent) / 100);

export function buildReport(rows: ReportRow[]): { professionals: ProfessionalReport[]; services: ServiceReport[]; totals: ReportTotals } {
  const pros = new Map<string, ProfessionalReport>();
  const services = new Map<string, ServiceReport>();

  for (const r of rows) {
    const p =
      pros.get(r.professionalId) ??
      ({
        professionalId: r.professionalId,
        professionalName: r.professionalName,
        commissionPercent: r.commissionPercent,
        appointments: 0,
        completed: 0,
        noShows: 0,
        canceled: 0,
        revenueCents: 0,
        commissionCents: 0,
        averageTicketCents: 0,
      } satisfies ProfessionalReport);
    if (r.status === 'CANCELED') p.canceled++;
    else p.appointments++;
    if (r.status === 'NO_SHOW') p.noShows++;
    if (r.status === 'COMPLETED') {
      p.completed++;
      p.revenueCents += r.priceCents;
      const s = services.get(r.serviceId) ?? { serviceId: r.serviceId, serviceName: r.serviceName, completed: 0, revenueCents: 0 };
      s.completed++;
      s.revenueCents += r.priceCents;
      services.set(r.serviceId, s);
    }
    pros.set(r.professionalId, p);
  }

  const professionals = [...pros.values()]
    .map((p) => ({
      ...p,
      commissionCents: commissionOf(p.revenueCents, p.commissionPercent),
      averageTicketCents: p.completed ? Math.round(p.revenueCents / p.completed) : 0,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents || a.professionalName.localeCompare(b.professionalName));

  const totals = professionals.reduce<ReportTotals>(
    (t, p) => ({
      appointments: t.appointments + p.appointments,
      completed: t.completed + p.completed,
      noShows: t.noShows + p.noShows,
      canceled: t.canceled + p.canceled,
      revenueCents: t.revenueCents + p.revenueCents,
      commissionCents: t.commissionCents + p.commissionCents,
      netRevenueCents: 0,
    }),
    { appointments: 0, completed: 0, noShows: 0, canceled: 0, revenueCents: 0, commissionCents: 0, netRevenueCents: 0 },
  );
  totals.netRevenueCents = totals.revenueCents - totals.commissionCents;

  return {
    professionals,
    services: [...services.values()].sort((a, b) => b.revenueCents - a.revenueCents),
    totals,
  };
}

/** Célula de CSV segura: aspas, ponto e vírgula e proteção contra injeção de fórmula no Excel. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV no padrão do Excel em pt-BR: BOM UTF-8, separador ";" e quebra CRLF. */
export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

/** Valor em reais com vírgula decimal (o Excel pt-BR entende como número). */
export const brlNumber = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
