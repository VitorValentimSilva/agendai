import { Prisma } from '@prisma/client';

/** Violação da exclusion constraint que impede agendamento duplo (SQLSTATE 23P01). */
export function isOverlapViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message ?? '';
  if (message.includes('Appointment_no_overlap') || message.includes('23P01')) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = JSON.stringify(error.meta ?? {});
    return meta.includes('23P01') || meta.includes('Appointment_no_overlap');
  }
  return false;
}

/**
 * Conflito de concorrência ao reservar: além da violação da exclusion constraint, inserções
 * simultâneas que colidem nela podem gerar deadlock (40P01) ou falha de serialização (40001).
 * O Postgres aborta só uma das transações — para o cliente é o mesmo caso: o horário foi ocupado.
 */
export function isBookingConflict(error: unknown): boolean {
  if (isOverlapViolation(error)) return true;
  if (!(error instanceof Error)) return false;
  const text = `${error.message} ${error instanceof Prisma.PrismaClientKnownRequestError ? JSON.stringify(error.meta ?? {}) : ''}`;
  return /40P01|40001|deadlock detected|could not serialize/i.test(text);
}

export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  if (!field) return true;
  return JSON.stringify(error.meta ?? {}).includes(field);
}

export function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
