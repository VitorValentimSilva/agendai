import type { Customer, PrismaClient } from '@prisma/client';
import { normalizeWhatsapp } from './phone.js';
import { isUniqueViolation } from './prisma-errors.js';

export interface CustomerInput {
  name: string;
  whatsapp: string;
  email?: string;
}

/**
 * Cria o cliente ou reaproveita o existente (mesmo WhatsApp no mesmo negócio).
 * Vindo do site (`trusted = false`) NÃO sobrescrevemos nome/e-mail de um cliente existente:
 * qualquer pessoa poderia digitar o WhatsApp de outra e trocar os dados dela. Só completamos
 * o e-mail se faltar. Vindo do painel (`trusted = true`), os dados informados atualizam o cadastro.
 */
export async function findOrCreateCustomer(
  prisma: Pick<PrismaClient, 'customer'>,
  businessId: string,
  input: CustomerInput,
  trusted: boolean,
): Promise<Customer> {
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  const email = input.email?.toLowerCase();
  const where = { businessId_whatsapp: { businessId, whatsapp } };
  try {
    const existing = await prisma.customer.findUnique({ where });
    if (existing) {
      if (trusted) return prisma.customer.update({ where, data: { name: input.name, ...(email ? { email } : {}) } });
      if (email && !existing.email) return prisma.customer.update({ where, data: { email } });
      return existing;
    }
    return await prisma.customer.create({ data: { businessId, whatsapp, name: input.name, ...(email ? { email } : {}) } });
  } catch (error) {
    // Dois pedidos simultâneos do mesmo cliente: o segundo encontra o registro criado pelo primeiro.
    if (isUniqueViolation(error)) return prisma.customer.findUniqueOrThrow({ where });
    throw error;
  }
}
