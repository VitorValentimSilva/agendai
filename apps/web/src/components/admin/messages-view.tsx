"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, LoaderCircle, MessagesSquare, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/site/state";
import { useIntegrations, useInvalidateAdmin, useMe, useMessages } from "@/hooks/use-admin";
import { api, unwrap } from "@/lib/api/client";
import { formatInTz } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { PageHeader } from "./page-header";

const KIND: Record<string, string> = { reminder: "Lembrete", waitlist: "Fila de espera", reply: "Resposta automática", inbound: "Cliente" };

export function MessagesView() {
  const me = useMe();
  const integrations = useIntegrations();
  const messages = useMessages();
  const invalidate = useInvalidateAdmin();
  const simulated = integrations.data?.whatsapp === "SIMULATED";
  const run = useMutation({
    mutationFn: () => unwrap(api.POST("/admin/messages/send-reminders")),
    onSuccess: (r) => {
      toast.success(r.sent ? `${r.sent} lembrete(s) enviado(s)` : "Nenhum lembrete pendente agora", {
        description: r.failed ? `${r.failed} falharam — veja o histórico.` : undefined,
      });
      void invalidate();
    },
    onError: (e) => toast.error("Não foi possível enviar", { description: e.message }),
  });

  return (
    <>
      <PageHeader
        title="Mensagens"
        description="Lembretes automáticos por WhatsApp. O cliente responde 1 para confirmar ou 2 para cancelar."
        actions={
          me.data?.role === "OWNER" && (
            <Button onClick={() => run.mutate()} disabled={run.isPending}>
              {run.isPending ? <LoaderCircle className="animate-spin" /> : <Send />} Enviar lembretes agora
            </Button>
          )
        }
      />

      {integrations.data && (
        <Card className="mb-4 gap-0 py-4">
          <CardContent className="flex items-start gap-3 px-4 text-sm sm:px-5">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", simulated ? "bg-info/15 text-info" : "bg-success/15 text-success")}>
              <Bot className="size-4" />
            </span>
            <div>
              <p className="font-medium">
                {simulated ? "Modo simulado" : "WhatsApp Cloud API conectada"}{" "}
                <Badge variant={simulated ? "info" : "success"} className="ml-1 align-middle">
                  {simulated ? "demo" : "ativo"}
                </Badge>
              </p>
              <p className="text-muted-foreground">
                {simulated
                  ? "As mensagens são registradas aqui, mas não saem de verdade. Para testar a resposta do cliente, use “Simular resposta” no detalhe de um agendamento."
                  : "Os lembretes são enviados pelo número oficial do negócio e as respostas chegam pelo webhook."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {messages.isError ? (
        <ErrorState message={messages.error.message} onRetry={() => void messages.refetch()} />
      ) : !messages.data ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : messages.data.length === 0 ? (
        <EmptyState icon={<MessagesSquare className="size-5" />} title="Nenhuma mensagem ainda" message="Os lembretes aparecem aqui assim que forem enviados." />
      ) : (
        <ol className="space-y-3" aria-label="Histórico de mensagens">
          {messages.data.map((m) => {
            const inbound = m.direction === "IN";
            return (
              <li key={m.id} className={cn("flex", inbound ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl border px-4 py-3 text-sm shadow-xs sm:max-w-[70%]",
                    inbound ? "rounded-bl-sm bg-card" : "rounded-br-sm border-gold/30 bg-gold/10",
                    m.status === "failed" && "border-destructive/40 bg-destructive/10",
                  )}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{inbound ? (m.customerName ?? formatPhone(m.phone)) : `Para ${m.customerName ?? formatPhone(m.phone)}`}</span>
                    <span>·</span>
                    <span>{KIND[m.kind] ?? m.kind}</span>
                    <span>·</span>
                    <time dateTime={m.createdAt}>{formatInTz(m.createdAt, "dd/MM HH:mm")}</time>
                  </div>
                  <p className="break-words whitespace-pre-line">{m.body}</p>
                  {m.status === "failed" && <p className="mt-1 text-xs text-destructive">Falhou: {m.error}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
