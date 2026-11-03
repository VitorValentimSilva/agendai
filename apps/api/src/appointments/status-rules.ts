import type { AppointmentStatus } from '@prisma/client';

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELED'],
  CONFIRMED: ['SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELED'],
  // "Faltou" pode ser corrigido para "Concluído" (cliente chegou atrasado).
  NO_SHOW: ['COMPLETED'],
  COMPLETED: [],
  CANCELED: [],
};

const LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
  NO_SHOW: 'Faltou',
};

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

/** Regras de mudança de status feitas pelo painel. */
export function checkStatusTransition(
  appointment: { status: AppointmentStatus; startsAt: Date },
  next: AppointmentStatus,
  now: Date,
): TransitionCheck {
  const from = appointment.status;
  if (from === next) return { ok: false, reason: `O agendamento já está como "${LABELS[next]}".` };
  if (!TRANSITIONS[from].includes(next)) {
    return { ok: false, reason: `Não é possível mudar de "${LABELS[from]}" para "${LABELS[next]}".` };
  }
  if ((next === 'COMPLETED' || next === 'NO_SHOW') && appointment.startsAt.getTime() > now.getTime()) {
    return {
      ok: false,
      reason: next === 'COMPLETED'
        ? 'Não é possível concluir um agendamento que ainda não começou.'
        : 'Não é possível marcar falta antes do horário do agendamento.',
    };
  }
  return { ok: true };
}

/** O cliente pode cancelar/remarcar pelo link? (respeita a política de cancelamento) */
export function checkCustomerChange(
  appointment: { status: AppointmentStatus; startsAt: Date },
  policyHours: number,
  now: Date,
): TransitionCheck & { deadline: Date } {
  const deadline = new Date(appointment.startsAt.getTime() - policyHours * 3_600_000);
  if (appointment.status !== 'SCHEDULED' && appointment.status !== 'CONFIRMED') {
    return { ok: false, reason: 'Este agendamento não pode mais ser alterado.', deadline };
  }
  if (now.getTime() > deadline.getTime()) {
    return {
      ok: false,
      reason: `Alterações pelo link só são aceitas até ${policyHours}h antes do horário. Fale com a gente pelo WhatsApp.`,
      deadline,
    };
  }
  return { ok: true, deadline };
}

export const STATUS_LABELS = LABELS;
