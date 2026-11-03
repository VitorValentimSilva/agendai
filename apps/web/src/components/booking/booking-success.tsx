"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { CalendarPlus, Check, Copy, Download, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/site/state";
import { useAppointmentByToken } from "@/hooks/use-public";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { AppointmentSummary } from "./appointment-summary";

export function BookingSuccess() {
  const { token } = useParams<{ token: string }>();
  const appointment = useAppointmentByToken(token);

  if (appointment.isError) {
    return <ErrorState title="Agendamento não encontrado" message={appointment.error.message} />;
  }
  if (!appointment.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto h-8 w-64" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const a = appointment.data;
  const manageUrl = typeof window !== "undefined" ? `${window.location.origin}/meu-agendamento/${token}` : `/meu-agendamento/${token}`;
  const googleUrl = googleCalendarUrl({
    title: `${a.service.name} — ${a.business.name}`,
    start: a.startsAt,
    end: a.endsAt,
    details: `Profissional: ${a.professional.name}\nCódigo: ${a.code}\nGerenciar: ${manageUrl}`,
    location: a.business.address,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center">
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="grid size-16 place-items-center rounded-full bg-success/15 text-success ring-8 ring-success/5"
        >
          <Check className="size-8" strokeWidth={2.5} />
        </motion.span>
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Agendamento confirmado!</h1>
        <p className="mt-2 text-muted-foreground">
          Te esperamos, {a.customerName.split(" ")[0]}. Guarde o código abaixo.
        </p>
        <div className="mt-5 rounded-2xl border border-dashed border-gold/50 bg-gold/5 px-6 py-3">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Código</p>
          <p className="font-mono text-2xl font-semibold tracking-[0.15em] text-gold" data-testid="appointment-code">
            {a.code}
          </p>
        </div>
      </div>

      <AppointmentSummary appointment={a} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant="outline" size="lg">
          <a href={googleUrl} target="_blank" rel="noreferrer">
            <CalendarPlus /> Adicionar ao Google Agenda
          </a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href={`/api/appointments/manage/${token}/ics`} download={`agendamento-${a.code}.ics`}>
            <Download /> Baixar .ics
          </a>
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <p className="font-medium">Precisa remarcar ou cancelar?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use o link abaixo até {a.business.cancellationPolicyHours}h antes do horário. Ele é pessoal — não compartilhe.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="sm:flex-1">
            <Link href={`/meu-agendamento/${token}`}>
              <Settings2 /> Gerenciar agendamento
            </Link>
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(manageUrl).then(
                () => toast.success("Link copiado!"),
                () => toast.error("Não foi possível copiar o link."),
              );
            }}
          >
            <Copy /> Copiar link
          </Button>
        </div>
      </div>
    </div>
  );
}
