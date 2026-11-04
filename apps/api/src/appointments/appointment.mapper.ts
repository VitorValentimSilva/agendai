import type { Appointment, Business, Customer, Payment, Professional, Service } from '@prisma/client';
import type { AdminAppointmentDto, PublicAppointmentDto } from './appointments.dto.js';
import { checkCustomerChange } from './status-rules.js';

export type AppointmentWithRelations = Appointment & {
  service: Service;
  professional: Professional;
  customer: Customer;
  payment: Payment | null;
};

export const appointmentInclude = { service: true, professional: true, customer: true, payment: true } as const;

export function toPublicAppointment(a: AppointmentWithRelations, business: Business, now = new Date()): PublicAppointmentDto {
  const change = checkCustomerChange(a, business.cancellationPolicyHours, now);
  return {
    code: a.code,
    status: a.status,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    priceCents: a.priceCents,
    notes: a.notes,
    service: { id: a.service.id, name: a.service.name, durationMinutes: a.service.durationMinutes },
    professional: { id: a.professional.id, name: a.professional.name, avatarUrl: a.professional.avatarUrl },
    customerName: a.customer.name,
    business: {
      name: business.name,
      timezone: business.timezone,
      address: `${business.addressLine} — ${business.city}/${business.state}`,
      whatsapp: business.whatsapp,
      cancellationPolicyHours: business.cancellationPolicyHours,
    },
    manage: { canChange: change.ok, reason: change.ok ? null : change.reason, deadline: change.deadline.toISOString() },
    payment: a.payment
      ? {
          status: a.payment.status,
          provider: a.payment.provider,
          amountCents: a.payment.amountCents,
          qrCode: a.payment.status === 'PENDING' ? a.payment.qrCode : null,
          qrCodeBase64: a.payment.status === 'PENDING' ? a.payment.qrCodeBase64 : null,
          ticketUrl: a.payment.status === 'PENDING' ? a.payment.ticketUrl : null,
          expiresAt: a.payment.expiresAt.toISOString(),
          paidAt: a.payment.paidAt?.toISOString() ?? null,
        }
      : null,
  };
}

export function toAdminAppointment(a: AppointmentWithRelations): AdminAppointmentDto {
  return {
    id: a.id,
    code: a.code,
    status: a.status,
    source: a.source,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    priceCents: a.priceCents,
    notes: a.notes,
    service: { id: a.service.id, name: a.service.name, durationMinutes: a.service.durationMinutes },
    professional: { id: a.professional.id, name: a.professional.name, avatarUrl: a.professional.avatarUrl },
    customer: { id: a.customer.id, name: a.customer.name, whatsapp: a.customer.whatsapp, email: a.customer.email },
    manageToken: a.manageToken,
    createdAt: a.createdAt.toISOString(),
    confirmedVia: a.confirmedVia,
    reminderSentAt: a.reminderSentAt?.toISOString() ?? null,
    payment: a.payment ? { status: a.payment.status, amountCents: a.payment.amountCents, provider: a.payment.provider } : null,
  };
}
