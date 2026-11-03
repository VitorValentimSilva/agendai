"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { TZDate } from "@date-fns/tz";
import { toast } from "sonner";
import { CalendarOff, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateAdmin, useTimeOffs } from "@/hooks/use-admin";
import { api, unwrap } from "@/lib/api/client";
import { DEFAULT_TZ, formatInTz, todayInTz } from "@/lib/format";

/** "2026-11-04T09:00" interpretado no fuso do negócio → ISO UTC */
function localToIso(value: string, tz: string): string {
  const [d, t = "00:00"] = value.split("T");
  const [y, m, day] = d!.split("-").map(Number);
  const [h, min] = t.split(":").map(Number);
  return new TZDate(y!, m! - 1, day!, h!, min!, 0, tz).toISOString();
}

/** Lista e cria bloqueios. Sem `professionalId` = negócio inteiro (feriados). */
export function TimeOffManager({ professionalId, timezone = DEFAULT_TZ }: { professionalId: string | null; timezone?: string }) {
  const today = todayInTz(timezone);
  const list = useTimeOffs({ from: today, ...(professionalId ? { professionalId } : {}) });
  const invalidate = useInvalidateAdmin();
  const [start, setStart] = useState(`${today}T09:00`);
  const [end, setEnd] = useState(`${today}T18:00`);
  const [reason, setReason] = useState("");

  const items = (list.data ?? []).filter((t) => (professionalId ? t.professionalId === professionalId : t.professionalId === null));

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/admin/time-offs", {
          body: { professionalId, startsAt: localToIso(start, timezone), endsAt: localToIso(end, timezone), reason: reason.trim() || null },
        }),
      ),
    onSuccess: () => {
      toast.success("Bloqueio criado", { description: "Esses horários não aparecem mais para agendamento." });
      setReason("");
      void invalidate();
    },
    onError: (e) => toast.error("Não foi possível bloquear", { description: e.message }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/admin/time-offs/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      toast.success("Bloqueio removido");
      void invalidate();
    },
    onError: (e) => toast.error("Não foi possível remover", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (end <= start) return toast.error("O fim precisa ser depois do início.");
          create.mutate();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor={`to-start-${professionalId}`}>Início</Label>
          <Input id={`to-start-${professionalId}`} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`to-end-${professionalId}`}>Fim</Label>
          <Input id={`to-end-${professionalId}`} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor={`to-reason-${professionalId}`}>Motivo</Label>
          <Input
            id={`to-reason-${professionalId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={professionalId ? "Folga, consulta médica..." : "Feriado, reforma..."}
          />
        </div>
        <Button type="submit" variant="secondary" className="sm:col-span-2" disabled={create.isPending}>
          {create.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />} Adicionar bloqueio
        </Button>
      </form>

      {list.isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarOff className="size-4" /> Nenhum bloqueio futuro.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <CalendarOff className="size-4 shrink-0 text-gold" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.reason ?? "Bloqueio"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatInTz(t.startsAt, "dd/MM HH:mm", timezone)} → {formatInTz(t.endsAt, "dd/MM HH:mm", timezone)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => remove.mutate(t.id)}
                aria-label={`Remover bloqueio ${t.reason ?? ""}`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
