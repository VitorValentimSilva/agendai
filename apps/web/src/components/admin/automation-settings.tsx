"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ExternalLink, KeyRound, Link2Off, LoaderCircle, MessageCircle, QrCode, Save, Trash2 } from "lucide-react";
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

  const connect = useMutation({
    mutationFn: () => unwrap(api.GET("/admin/integrations/mercadopago/connect")),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e) => toast.error("Não foi possível conectar", { description: e.message }),
  });
  const disconnect = useMutation({
    mutationFn: () => unwrap(api.DELETE("/admin/integrations/mercadopago")),
    onSuccess: (data) => {
      toast.success("Mercado Pago desconectado");
      setPaymentMode(data.paymentMode);
      void invalidate();
    },
    onError: (e) => toast.error("Não foi possível desconectar", { description: e.message }),
  });

  // Retorno do OAuth do Mercado Pago (?mercadopago=ok|erro)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("mercadopago");
    if (!result) return;
    if (result === "ok") toast.success("Mercado Pago conectado!", { description: "Agora escolha Sinal ou Valor total e salve a cobrança." });
    else toast.error("Não foi possível conectar o Mercado Pago", { description: params.get("motivo") ?? undefined });
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const mp = initial.mercadoPago;
  const canOAuth = integrations.data?.mercadoPagoOAuth ?? false;
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
            <p className="text-xs text-muted-foreground">O envio é automático (a cada 15 minutos) — você também pode disparar em Mensagens.</p>
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

          <div className="grid gap-3 border-t pt-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-gold" /> Conta do Mercado Pago
              {mp.connected && <Badge variant="success">{mp.via === "OAUTH" ? "conectada" : "token manual"}</Badge>}
            </p>
            {mp.connected ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">
                  {mp.via === "OAUTH" ? `Conta #${mp.userId ?? "—"} — o Pix cai direto nela.` : "Usando o access token colado manualmente."}
                </span>
                <Button variant="ghost" size="sm" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
                  {disconnect.isPending ? <LoaderCircle className="animate-spin" /> : <Link2Off />} Desconectar
                </Button>
              </div>
            ) : canOAuth ? (
              <div className="grid gap-2">
                <Button className="justify-self-start" disabled={connect.isPending} onClick={() => connect.mutate()}>
                  {connect.isPending ? <LoaderCircle className="animate-spin" /> : <ExternalLink />} Conectar Mercado Pago
                </Button>
                <p className="text-xs text-muted-foreground">
                  Você entra na sua conta do Mercado Pago e autoriza o Agendaí. Os pagamentos caem direto na sua conta — tenha uma chave Pix
                  cadastrada.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sem conta conectada, o Pix funciona em modo de demonstração (com botão “simular pagamento”).
              </p>
            )}

            <details className="group rounded-lg border px-3 py-2 text-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between text-muted-foreground">
                Avançado: colar access token manualmente
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 grid gap-2">
                <Label htmlFor="a-token" className="sr-only">
                  Access token do Mercado Pago
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
                  {mp.via === "MANUAL" && (
                    <Button variant="ghost" size="icon" aria-label="Remover token" onClick={() => save.mutate({ mercadoPagoToken: null })}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Para quem tem a própria aplicação no Mercado Pago. Guardado cifrado e nunca exibido; substitui a conta conectada.
                </p>
              </div>
            </details>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
