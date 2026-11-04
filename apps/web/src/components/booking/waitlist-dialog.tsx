"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BellRing, Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, unwrap } from "@/lib/api/client";
import { formatLocalDate } from "@/lib/format";
import { isValidPhone, maskPhone } from "@/lib/phone";

/** Entrar na fila de espera de um dia sem vagas. */
export function WaitlistDialog({ serviceId, professionalId, date }: { serviceId: string; professionalId: string; date: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [touched, setTouched] = useState(false);
  const join = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/waitlist", { body: { serviceId, professionalId, date, customer: { name: name.trim(), whatsapp } } })),
    onError: (e) => toast.error("Não foi possível entrar na fila", { description: e.message }),
  });
  const leave = useMutation({
    mutationFn: (token: string) => unwrap(api.POST("/waitlist/{token}/leave", { params: { path: { token } } })),
    onSuccess: () => {
      toast.success("Você saiu da fila de espera.");
      setOpen(false);
      join.reset();
    },
  });
  const nameError = touched && name.trim().length < 2 ? "Informe seu nome." : undefined;
  const phoneError = touched && !isValidPhone(whatsapp) ? "WhatsApp inválido." : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <BellRing /> Entrar na fila de espera
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {join.data ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success">
              <Check className="size-6" />
            </span>
            <DialogTitle>Você está na fila!</DialogTitle>
            <DialogDescription>
              Se abrir uma vaga em <span className="first-letter:uppercase">{formatLocalDate(date)}</span>, avisamos pelo WhatsApp com
              o link para agendar. Quem agendar primeiro garante o horário.
            </DialogDescription>
            <DialogFooter className="w-full sm:justify-center">
              <Button variant="ghost" onClick={() => leave.mutate(join.data!.token)} disabled={leave.isPending}>
                Sair da fila
              </Button>
              <Button onClick={() => setOpen(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="grid gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (name.trim().length >= 2 && isValidPhone(whatsapp)) join.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>Fila de espera</DialogTitle>
              <DialogDescription>
                Não há vagas em <span className="first-letter:uppercase">{formatLocalDate(date)}</span>. Deixe seu WhatsApp e avisamos se
                alguém cancelar.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="w-name">Nome</Label>
              <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!nameError} />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="w-phone">WhatsApp</Label>
              <Input
                id="w-phone"
                inputMode="tel"
                placeholder="(19) 99999-0000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                aria-invalid={!!phoneError}
              />
              {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={join.isPending}>
                {join.isPending ? <LoaderCircle className="animate-spin" /> : <BellRing />} Me avise
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
