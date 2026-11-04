"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarSync, Copy, LoaderCircle, Plug, RefreshCw, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminProfessionals, useIntegrations, useInvalidateAdmin } from "@/hooks/use-admin";
import { api, unwrap } from "@/lib/api/client";

/** Feed iCal (qualquer app de agenda) + Google Calendar (sincronização em tempo real). */
export function CalendarSyncPanel({ professionalId }: { professionalId: string }) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAdmin();
  const integrations = useIntegrations();
  const professionals = useAdminProfessionals();
  const pro = professionals.data?.find((p) => p.id === professionalId);
  const feed = useQuery({
    queryKey: ["admin", "calendar-feed", professionalId],
    queryFn: () => unwrap(api.GET("/admin/professionals/{id}/calendar-feed", { params: { path: { id: professionalId } } })),
  });
  const setFeed = (url: string | null) => queryClient.setQueryData(["admin", "calendar-feed", professionalId], { url });

  const enable = useMutation({
    mutationFn: () => unwrap(api.POST("/admin/professionals/{id}/calendar-feed", { params: { path: { id: professionalId } } })),
    onSuccess: (r) => {
      setFeed(r.url);
      toast.success("Link da agenda gerado", { description: "Links anteriores deixaram de funcionar." });
    },
    onError: (e) => toast.error("Não foi possível gerar o link", { description: e.message }),
  });
  const disable = useMutation({
    mutationFn: () => unwrap(api.DELETE("/admin/professionals/{id}/calendar-feed", { params: { path: { id: professionalId } } })),
    onSuccess: () => {
      setFeed(null);
      toast.success("Link desativado");
    },
  });
  const connect = useMutation({
    mutationFn: () => unwrap(api.GET("/admin/professionals/{id}/google/connect", { params: { path: { id: professionalId } } })),
    onSuccess: (r) => {
      if (r.url) window.location.href = r.url;
    },
    onError: (e) => toast.error("Não foi possível conectar", { description: e.message }),
  });
  const disconnect = useMutation({
    mutationFn: () => unwrap(api.DELETE("/admin/professionals/{id}/google", { params: { path: { id: professionalId } } })),
    onSuccess: () => {
      toast.success("Google Calendar desconectado");
      void invalidate();
    },
  });

  const url = feed.data?.url;

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl border p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarSync className="size-4 text-gold" /> Link da agenda (iCal)
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Assine no Google Agenda (“Adicionar agenda → Por URL”), Apple Calendário ou Outlook. Atualiza sozinho a cada algumas horas.
            O link é secreto: quem tiver ele vê os nomes dos clientes.
          </p>
        </div>
        {feed.isLoading ? null : url ? (
          <>
            <div className="flex gap-2">
              <input readOnly value={url} aria-label="Link da agenda" className="h-9 min-w-0 flex-1 truncate rounded-lg border bg-muted/40 px-3 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void navigator.clipboard?.writeText(url).then(() => toast.success("Link copiado!"))}
              >
                <Copy /> Copiar
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => enable.mutate()} disabled={enable.isPending}>
                <RefreshCw /> Gerar novo link
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => disable.mutate()} disabled={disable.isPending}>
                Desativar
              </Button>
            </div>
          </>
        ) : (
          <Button size="sm" onClick={() => enable.mutate()} disabled={enable.isPending}>
            {enable.isPending ? <LoaderCircle className="animate-spin" /> : <CalendarSync />} Gerar link da agenda
          </Button>
        )}
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            Google Calendar
            {pro?.googleEmail ? <Badge variant="success">conectado</Badge> : <Badge variant="secondary">tempo real</Badge>}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada agendamento criado, remarcado ou cancelado aparece na hora no seu Google Agenda.
          </p>
        </div>
        {!integrations.data?.google ? (
          <p className="text-sm text-muted-foreground">
            Indisponível nesta instalação (configure <code className="text-xs">GOOGLE_CLIENT_ID</code> e{" "}
            <code className="text-xs">GOOGLE_CLIENT_SECRET</code> na API). O link iCal acima funciona sem configuração.
          </p>
        ) : pro?.googleEmail ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              Conectado a <strong>{pro.googleEmail}</strong>
            </span>
            <Button size="sm" variant="ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              <Unplug /> Desconectar
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending}>
            {connect.isPending ? <LoaderCircle className="animate-spin" /> : <Plug />} Conectar Google Calendar
          </Button>
        )}
      </section>
    </div>
  );
}
