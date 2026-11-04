import { CalendarClock, MapPin, Scissors, User, Wallet } from "lucide-react";
import type { Schemas } from "@/lib/api/client";
import { formatDateLong, formatDuration, formatPrice, formatTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

type Appointment = Schemas["PublicAppointmentDto"];

export const STATUS_META: Record<Appointment["status"], { label: string; variant: "info" | "success" | "destructive" | "warning" | "secondary" }> = {
  SCHEDULED: { label: "Agendado", variant: "info" },
  CONFIRMED: { label: "Confirmado", variant: "success" },
  COMPLETED: { label: "Concluído", variant: "secondary" },
  CANCELED: { label: "Cancelado", variant: "destructive" },
  NO_SHOW: { label: "Não compareceu", variant: "warning" },
  PENDING_PAYMENT: { label: "Aguardando pagamento", variant: "warning" },
};

export function StatusBadge({ status }: { status: Appointment["status"] }) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function AppointmentSummary({ appointment }: { appointment: Appointment }) {
  const tz = appointment.business.timezone;
  const rows = [
    { icon: Scissors, label: "Serviço", value: `${appointment.service.name} · ${formatDuration(appointment.service.durationMinutes)}` },
    { icon: User, label: "Profissional", value: appointment.professional.name },
    {
      icon: CalendarClock,
      label: "Quando",
      value: `${formatDateLong(appointment.startsAt, tz)}, ${formatTime(appointment.startsAt, tz)} – ${formatTime(appointment.endsAt, tz)}`,
    },
    { icon: MapPin, label: "Onde", value: `${appointment.business.name} — ${appointment.business.address}` },
    { icon: Wallet, label: "Valor", value: `${formatPrice(appointment.priceCents)} (pagamento no local)` },
  ];
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {rows.map((r) => (
        <li key={r.label} className="flex items-start gap-3 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold">
            <r.icon className="size-4" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="text-muted-foreground">{r.label}</p>
            <p className="font-medium first-letter:uppercase">{r.value}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
