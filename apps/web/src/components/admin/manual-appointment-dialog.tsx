"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarX, LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminProfessionals, useAdminServices, useInvalidateAdmin, useMe } from "@/hooks/use-admin";
import { api, unwrap } from "@/lib/api/client";
import { formatDuration, formatPrice } from "@/lib/format";
import { isValidPhone, maskPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export function ManualAppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultProfessionalId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  defaultProfessionalId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>Para clientes que agendaram por telefone ou no balcão.</DialogDescription>
        </DialogHeader>
        {open && <ManualForm defaultDate={defaultDate} defaultProfessionalId={defaultProfessionalId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ManualForm({ defaultDate, defaultProfessionalId, onDone }: { defaultDate: string; defaultProfessionalId?: string; onDone: () => void }) {
  const me = useMe();
  const services = useAdminServices();
  const professionals = useAdminProfessionals();
  const invalidate = useInvalidateAdmin();
  const isPro = me.data?.role === "PROFESSIONAL";

  const [serviceId, setServiceId] = useState<string>();
  const [professionalId, setProfessionalId] = useState<string>(isPro ? (me.data?.professionalId ?? "any") : (defaultProfessionalId ?? "any"));
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState<string>();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  const activeServices = services.data?.filter((s) => s.active) ?? [];
  const service = activeServices.find((s) => s.id === serviceId);
  const pros = (professionals.data ?? []).filter((p) => p.active && (!serviceId || p.serviceIds.includes(serviceId)));

  const slots = useQuery({
    queryKey: ["admin", "availability", serviceId, professionalId, date],
    enabled: Boolean(serviceId && date),
    queryFn: () =>
      unwrap(api.GET("/admin/availability", { params: { query: { serviceId: serviceId!, professionalId, date } } })),
  });

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/admin/appointments", {
          body: { serviceId: serviceId!, professionalId, startsAt: start!, customer: { name: name.trim(), whatsapp }, ...(notes.trim() ? { notes: notes.trim() } : {}) },
        }),
      ),
    onSuccess: (a) => {
      toast.success("Agendamento criado", { description: `${a.customer.name} · ${a.service.name} com ${a.professional.name}` });
      void invalidate();
      onDone();
    },
    onError: (e) => {
      toast.error("Não foi possível agendar", { description: e.message });
      setStart(undefined);
      void slots.refetch();
    },
  });

  const nameError = touched && name.trim().length < 2 ? "Informe o nome do cliente." : undefined;
  const phoneError = touched && !isValidPhone(whatsapp) ? "WhatsApp inválido." : undefined;

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!serviceId || !start || name.trim().length < 2 || !isValidPhone(whatsapp)) return;
        create.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="m-service">Serviço</Label>
          <Select
            value={serviceId}
            onValueChange={(v) => {
              setServiceId(v);
              setStart(undefined);
            }}
          >
            <SelectTrigger id="m-service" className="w-full">
              <SelectValue placeholder="Escolha o serviço" />
            </SelectTrigger>
            <SelectContent>
              {activeServices.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMinutes)} · {formatPrice(s.priceCents)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="m-pro">Profissional</Label>
          <Select
            value={professionalId}
            disabled={isPro}
            onValueChange={(v) => {
              setProfessionalId(v);
              setStart(undefined);
            }}
          >
            <SelectTrigger id="m-pro" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!isPro && <SelectItem value="any">Qualquer (menos ocupado)</SelectItem>}
              {(isPro ? (professionals.data ?? []).filter((p) => p.id === me.data?.professionalId) : pros).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="m-date">Data</Label>
        <Input
          id="m-date"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setStart(undefined);
          }}
          className="w-full sm:w-52"
        />
      </div>

      <div className="grid gap-2">
        <Label>Horário</Label>
        {!serviceId ? (
          <p className="text-sm text-muted-foreground">Escolha um serviço para ver os horários livres.</p>
        ) : slots.isLoading ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : slots.data?.slots.length ? (
          <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6" role="radiogroup" aria-label="Horários">
            {slots.data.slots.map((s) => (
              <button
                key={s.start}
                type="button"
                role="radio"
                aria-checked={start === s.start}
                onClick={() => setStart(s.start)}
                className={cn(
                  "h-9 cursor-pointer rounded-md border text-sm tabular-nums transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  start === s.start ? "border-primary bg-primary text-primary-foreground" : "hover:border-gold/60",
                )}
              >
                {s.time}
              </button>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarX className="size-4" /> Sem horários livres nesta data.
          </p>
        )}
        {touched && !start && serviceId && <p className="text-sm text-destructive">Escolha um horário.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="m-name">Cliente</Label>
          <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" aria-invalid={!!nameError} />
          {nameError && <p className="text-sm text-destructive">{nameError}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="m-phone">WhatsApp</Label>
          <Input
            id="m-phone"
            inputMode="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
            placeholder="(19) 99999-0000"
            aria-invalid={!!phoneError}
          />
          {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="m-notes">
          Observações <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea id="m-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}
          Criar agendamento{service ? ` · ${formatPrice(service.priceCents)}` : ""}
        </Button>
      </DialogFooter>
    </form>
  );
}
