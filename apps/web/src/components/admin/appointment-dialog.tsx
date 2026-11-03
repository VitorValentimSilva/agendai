"use client";

import { toast } from "sonner";
import { Ban, CalendarClock, Check, CheckCheck, Globe, LoaderCircle, MessageCircle, Phone, Scissors, Store, User, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useNow } from "@/hooks/use-now";
import { useChangeStatus, type AdminAppointment, type AppointmentStatus } from "@/hooks/use-admin";
import { formatDateLong, formatDuration, formatPrice, formatTime } from "@/lib/format";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/status";

export function reminderMessage(a: AdminAppointment, timezone: string, origin: string): string {
  const first = a.customer.name.split(" ")[0];
  return (
    `Olá, ${first}! Passando para lembrar do seu horário na Barbearia Navalha de Ouro: ` +
    `${a.service.name} com ${a.professional.name}, ${formatDateLong(a.startsAt, timezone)} às ${formatTime(a.startsAt, timezone)}. ` +
    `Se precisar remarcar ou cancelar: ${origin}/meu-agendamento/${a.manageToken}`
  );
}

export function AppointmentDialog({
  appointment,
  timezone,
  onOpenChange,
}: {
  appointment: AdminAppointment | null;
  timezone: string;
  onOpenChange: (open: boolean) => void;
}) {
  const change = useChangeStatus();
  const now = useNow();
  const a = appointment;

  function setStatus(status: AppointmentStatus, message: string) {
    if (!a) return;
    change.mutate(
      { id: a.id, status },
      {
        onSuccess: () => {
          toast.success(message);
          onOpenChange(false);
        },
      },
    );
  }

  const started = a ? new Date(a.startsAt).getTime() <= now : false;
  const active = a?.status === "SCHEDULED" || a?.status === "CONFIRMED";

  return (
    <Dialog open={Boolean(a)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {a && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                <span className="font-mono text-xs tracking-wider text-muted-foreground">{a.code}</span>
              </div>
              <DialogTitle className="pt-1 text-xl">{a.customer.name}</DialogTitle>
              <DialogDescription className="first-letter:uppercase">
                {formatDateLong(a.startsAt, timezone)} · {formatTime(a.startsAt, timezone)}–{formatTime(a.endsAt, timezone)}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
              <Row icon={Scissors} label="Serviço" value={`${a.service.name} · ${formatDuration(a.service.durationMinutes)} · ${formatPrice(a.priceCents)}`} />
              <Row icon={User} label="Profissional" value={a.professional.name} />
              <Row icon={Phone} label="WhatsApp" value={formatPhone(a.customer.whatsapp)} />
              <Row icon={a.source === "ONLINE" ? Globe : Store} label="Origem" value={a.source === "ONLINE" ? "Agendado pelo site" : "Agendamento manual"} />
              {a.notes && <Row icon={CalendarClock} label="Observações" value={a.notes} />}
            </dl>

            <Button asChild variant="outline" className="w-full border-success/40 text-success hover:bg-success/10 hover:text-success">
              <a href={whatsappLink(a.customer.whatsapp, reminderMessage(a, timezone, window.location.origin))} target="_blank" rel="noreferrer">
                <MessageCircle /> Lembrar no WhatsApp
              </a>
            </Button>

            {(active || a.status === "NO_SHOW") && (
              <div className="grid grid-cols-2 gap-2">
                {a.status === "SCHEDULED" && (
                  <Button onClick={() => setStatus("CONFIRMED", "Agendamento confirmado")} disabled={change.isPending}>
                    {change.isPending ? <LoaderCircle className="animate-spin" /> : <Check />} Confirmar
                  </Button>
                )}
                <Button
                  variant="success"
                  onClick={() => setStatus("COMPLETED", "Atendimento concluído")}
                  disabled={!started || change.isPending}
                  title={started ? undefined : "Disponível a partir do horário do atendimento"}
                >
                  <CheckCheck /> Concluir
                </Button>
                {active && (
                  <Button
                    variant="outline"
                    onClick={() => setStatus("NO_SHOW", "Marcado como falta")}
                    disabled={!started || change.isPending}
                    title={started ? undefined : "Disponível a partir do horário do atendimento"}
                  >
                    <UserX /> Faltou
                  </Button>
                )}
                {active && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-destructive hover:text-destructive" disabled={change.isPending}>
                        <Ban /> Cancelar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar o agendamento de {a.customer.name.split(" ")[0]}?</AlertDialogTitle>
                        <AlertDialogDescription>O horário volta a ficar disponível para agendamento online.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => setStatus("CANCELED", "Agendamento cancelado")}>
                          Cancelar agendamento
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
            {active && !started && (
              <p className="text-center text-xs text-muted-foreground">“Concluir” e “Faltou” ficam disponíveis a partir do horário marcado.</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-gold" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium break-words">{value}</dd>
      </div>
    </div>
  );
}
