"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, LoaderCircle, MessageCircle, QrCode, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useIntegrations, useInvalidateAdmin } from "@/hooks/use-admin";
import { api, unwrap, type Schemas } from "@/lib/api/client";

type Settings = Schemas["BusinessSettingsDto"];
type Body = Schemas["UpdateBusinessDto"];

/** Lembretes por WhatsApp e cobrança Pix. */
export function AutomationSettings({ initial }: { initial: Settings }) {
  const invalidate = useInvalidateAdmin();
  const integrations = useIntegrations();
  const [remindersEnabled, setRemindersEnabled] = useState(initial.remindersEnabled);
  const [reminderHours, setReminderHours] = useState(initial.reminderHoursBefore);
  const [paymentMode, setPaymentMode] = useState(initial.paymentMode);
  const [deposit, setDeposit] = useState(initial.depositPercent);
  const [expiry, setExpiry] = useState(initial.paymentExpiryMinutes);
  const [token, setToken] = useState("");

  const save = useMutation({
    mutationFn: (body: Body) => unwrap(api.PATCH("/admin/business", { body })),
    onSuccess: () => {
      toast.success("Configurações salvas");
      setToken("");
      void invalidate();
    },
    onError: (e) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const pixReal = integrations.data?.pix === "MERCADO_PAGO";
  const waReal = integrations.data?.whatsapp === "WHATSAPP_CLOUD";

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-4 text-gold" /> Lembretes por WhatsApp
            <Badge variant={waReal ? "success" : "info"}>{waReal ? "Cloud API" : "simulado"}</Badge>
          </CardTitle>
          <CardDescription>O cliente recebe o lembrete e responde 1 para confirmar ou 2 para cancelar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <Label htmlFor="a-rem" className="font-normal">
              Enviar lembretes automáticos
            </Label>
            <Switch id="a-rem" checked={remindersEnabled} onCheckedChange={setRemindersEnabled} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="a-hours">Enviar até quantas horas antes</Label>
            <Input id="a-hours" type="number" min={1} max={72} value={reminderHours} onChange={(e) => setReminderHours(Number(e.target.value))} className="w-32" />
            <p className="text-xs text-muted-foreground">O envio roda uma vez por dia (cron) — você também pode disparar em Mensagens.</p>
          </div>
          <Button
            className="justify-self-end"
            disabled={save.isPending}
            onClick={() => save.mutate({ remindersEnabled, reminderHoursBefore: reminderHours })}
          >
            {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Salvar lembretes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-4 text-gold" /> Pagamento via Pix
            <Badge variant={pixReal ? "success" : "info"}>{pixReal ? "Mercado Pago" : "simulado"}</Badge>
          </CardTitle>
          <CardDescription>Cobre um sinal ou o valor total para confirmar o agendamento online.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2 sm:col-span-3">
              <Label htmlFor="a-mode">Cobrança</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as Settings["paymentMode"])}>
                <SelectTrigger id="a-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Não cobrar (pagamento no local)</SelectItem>
                  <SelectItem value="DEPOSIT">Sinal (porcentagem do serviço)</SelectItem>
                  <SelectItem value="FULL">Valor total</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paymentMode === "DEPOSIT" && (
              <div className="grid gap-2">
                <Label htmlFor="a-dep">Sinal (%)</Label>
                <Input id="a-dep" type="number" min={1} max={100} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} />
              </div>
            )}
            {paymentMode !== "NONE" && (
              <div className="grid gap-2">
                <Label htmlFor="a-exp">Prazo do Pix (min)</Label>
                <Input id="a-exp" type="number" min={5} max={1440} value={expiry} onChange={(e) => setExpiry(Number(e.target.value))} />
              </div>
            )}
          </div>
          <Button
            className="justify-self-end"
            disabled={save.isPending}
            onClick={() => save.mutate({ paymentMode, depositPercent: deposit, paymentExpiryMinutes: expiry })}
          >
            {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Salvar cobrança
          </Button>

          <div className="grid gap-2 border-t pt-4">
            <Label htmlFor="a-token" className="flex items-center gap-2">
              <KeyRound className="size-4 text-gold" /> Access token do Mercado Pago
              {initial.hasMercadoPagoToken && <Badge variant="success">salvo</Badge>}
            </Label>
            <div className="flex gap-2">
              <Input
                id="a-token"
                type="password"
                autoComplete="off"
                placeholder={initial.hasMercadoPagoToken ? "•••••••• (salvo — digite para trocar)" : "APP_USR-..."}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button variant="secondary" disabled={!token.trim() || save.isPending} onClick={() => save.mutate({ mercadoPagoToken: token.trim() })}>
                Salvar
              </Button>
              {initial.hasMercadoPagoToken && (
                <Button variant="ghost" size="icon" aria-label="Remover token" onClick={() => save.mutate({ mercadoPagoToken: null })}>
                  <Trash2 />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Guardado cifrado e nunca exibido. Sem token, o Pix funciona em modo de demonstração (com botão “simular pagamento”).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
