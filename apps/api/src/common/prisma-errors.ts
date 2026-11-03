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

export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  if (!field) return true;
  return JSON.stringify(error.meta ?? {}).includes(field);
}

export function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
