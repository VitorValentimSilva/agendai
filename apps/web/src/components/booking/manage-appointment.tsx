"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, CalendarPlus, CalendarX, Download, Info, LoaderCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/site/state";
import { useAppointmentByToken } from "@/hooks/use-public";
import { api, ApiError, unwrap } from "@/lib/api/client";
import { formatDateLong, formatInTz, formatPrice, formatTime } from "@/lib/format";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { whatsappLink } from "@/lib/phone";
import { AppointmentSummary, StatusBadge } from "./appointment-summary";
import { DateSlotPicker, type Slot } from "./date-slot-picker";
import { PixPayment } from "./pix-payment";

export function ManageAppointment() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const appointment = useAppointmentByToken(token);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [date, setDate] = useState<string>();
  const [slot, setSlot] = useState<Slot>();

  const cancel = useMutation({
    mutationFn: () => unwrap(api.POST("/appointments/manage/{token}/cancel", { params: { path: { token } } })),
    onSuccess: (data) => {
      queryClient.setQueryData(["appointment", token], data);
      toast.success("Agendamento cancelado", { description: "O horário foi liberado. Esperamos te ver em breve!" });
    },
    onError: (e) => toast.error("Não foi possível cancelar", { description: e.message }),
  });

  const reschedule = useMutation({
    mutationFn: (startsAt: string) =>
      unwrap(api.POST("/appointments/manage/{token}/reschedule", { params: { path: { token } }, body: { startsAt } })),
    onSuccess: (data) => {
      queryClient.setQueryData(["appointment", token], data);
      void queryClient.invalidateQueries({ queryKey: ["slots"] });
      setRescheduleOpen(false);
      setSlot(undefined);
      toast.success("Horário remarcado!", {
        description: `${formatDateLong(data.startsAt, data.business.timezone)} às ${formatTime(data.startsAt, data.business.timezone)}`,
      });
    },
    onError: (e) => {
      toast.error("Não foi possível remarcar", { description: e.message });
      if (e instanceof ApiError && e.status === 409) {
        setSlot(undefined);
        void queryClient.invalidateQueries({ queryKey: ["slots"] });
      }
    },
  });

  if (appointment.isError) {
    return (
      <ErrorState
        title="Agendamento não encontrado"
        message="Confira se o link está completo. Se precisar, fale com a barbearia pelo WhatsApp."
      />
    );
  }
  if (!appointment.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const a = appointment.data;
  const tz = a.business.timezone;
  const active = a.status === "SCHEDULED" || a.status === "CONFIRMED";
  const pendingPix = a.status === "PENDING_PAYMENT";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Código <span className="font-mono font-semibold tracking-wider text-gold">{a.code}</span>
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Meu agendamento</h1>
        </div>
        <StatusBadge status={a.status} />
      </div>

      {a.status === "PENDING_PAYMENT" && a.payment?.status === "PENDING" && <PixPayment appointment={a} token={token} />}
      {a.payment?.status === "PAID" && (
        <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          Pix de <strong>{formatPrice(a.payment.amountCents)}</strong> recebido
          {a.payment.amountCents < a.priceCents ? ` · restante ${formatPrice(a.priceCents - a.payment.amountCents)} no local` : ""}.
          {a.status === "CANCELED" && " Para estorno, fale com o estabelecimento pelo WhatsApp."}
        </p>
      )}

      <AppointmentSummary appointment={a} />

      {active && a.manage.canChange && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-gold" />
          Você pode remarcar ou cancelar até {formatInTz(a.manage.deadline, "dd/MM 'às' HH:mm", tz)}.
        </p>
      )}
      {active && !a.manage.canChange && a.manage.reason && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" />
          {a.manage.reason}
        </p>
      )}

      {pendingPix && (
        <Button variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
          {cancel.isPending ? <LoaderCircle className="animate-spin" /> : <CalendarX />} Desistir e liberar o horário
        </Button>
      )}

      {active && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" disabled={!a.manage.canChange} onClick={() => setRescheduleOpen(true)}>
            <CalendarClock /> Remarcar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="lg" variant="outline" disabled={!a.manage.canChange || cancel.isPending} className="hover:border-destructive/50 hover:text-destructive">
                {cancel.isPending ? <LoaderCircle className="animate-spin" /> : <CalendarX />} Cancelar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar este agendamento?</AlertDialogTitle>
                <AlertDialogDescription>
                  {a.service.name} em {formatDateLong(a.startsAt, tz)} às {formatTime(a.startsAt, tz)}. O horário será liberado para outra pessoa.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Manter</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => cancel.mutate()}>
                  Sim, cancelar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {active && (
          <>
            <Button asChild variant="ghost" size="sm">
              <a
                href={googleCalendarUrl({ title: `${a.service.name} — ${a.business.name}`, start: a.startsAt, end: a.endsAt, location: a.business.address })}
                target="_blank"
                rel="noreferrer"
              >
                <CalendarPlus /> Google Agenda
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={`/api/appointments/manage/${token}/ics`} download>
                <Download /> Baixar .ics
              </a>
            </Button>
          </>
        )}
        <Button asChild variant="ghost" size="sm">
          <a href={whatsappLink(a.business.whatsapp, `Olá! Sobre meu agendamento ${a.code}...`)} target="_blank" rel="noreferrer">
            <MessageCircle /> Falar no WhatsApp
          </a>
        </Button>
        {!active && (
          <Button asChild size="sm">
            <Link href="/agendar">Fazer novo agendamento</Link>
          </Button>
        )}
      </div>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Remarcar horário</DialogTitle>
            <DialogDescription>
              {a.service.name} com {a.professional.name}. Escolha um novo dia e horário.
            </DialogDescription>
          </DialogHeader>
          {rescheduleOpen && (
            <DateSlotPicker
              serviceId={a.service.id}
              professionalId={a.professional.id}
              timezone={tz}
              maxAdvanceDays={a.business.maxAdvanceDays}
              manageToken={token}
              date={date}
              onDateChange={(d) => {
                setDate(d);
                setSlot(undefined);
              }}
              slot={slot}
              onSlotChange={setSlot}
              excludeStart={a.startsAt}
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescheduleOpen(false)}>
              Voltar
            </Button>
            <Button disabled={!slot || reschedule.isPending} onClick={() => slot && reschedule.mutate(slot.start)}>
              {reschedule.isPending && <LoaderCircle className="animate-spin" />}
              {slot ? `Remarcar para ${formatInTz(slot.start, "dd/MM 'às' HH:mm", tz)}` : "Escolha um horário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
