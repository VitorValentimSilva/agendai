"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useInvalidateAdmin } from "@/hooks/use-admin";
import { api, unwrap, type Schemas } from "@/lib/api/client";
import { hhmmToMinutes, minutesToHHMM, WEEKDAYS } from "@/lib/format";

type Item = Schemas["WorkingHoursItemDto"];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // segunda → domingo

/** Editor do expediente semanal: vários intervalos por dia (ex.: manhã e tarde). */
export function WorkingHoursEditor({ professionalId, initial }: { professionalId: string; initial: Item[] }) {
  const invalidate = useInvalidateAdmin();
  const [days, setDays] = useState(() =>
    Object.fromEntries(
      ORDER.map((d) => [
        d,
        initial.filter((i) => i.weekday === d).map((i) => ({ start: minutesToHHMM(i.startMinute), end: minutesToHHMM(i.endMinute) })),
      ]),
    ) as Record<number, Array<{ start: string; end: string }>>,
  );

  const save = useMutation({
    mutationFn: () => {
      const items = ORDER.flatMap((weekday) =>
        days[weekday]!.map((r) => ({ weekday, startMinute: hhmmToMinutes(r.start), endMinute: r.end === "00:00" ? 1440 : hhmmToMinutes(r.end) })),
      );
      return unwrap(api.PUT("/admin/professionals/{id}/working-hours", { params: { path: { id: professionalId } }, body: { items } }));
    },
    onSuccess: () => {
      toast.success("Expediente salvo");
      void invalidate();
    },
    onError: (e) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const update = (d: number, fn: (rows: Array<{ start: string; end: string }>) => Array<{ start: string; end: string }>) =>
    setDays((prev) => ({ ...prev, [d]: fn(prev[d]!) }));

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-xl border">
        {ORDER.map((d) => {
          const rows = days[d]!;
          const open = rows.length > 0;
          return (
            <li key={d} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start">
              <div className="flex w-36 shrink-0 items-center gap-3 pt-1.5">
                <Switch
                  checked={open}
                  onCheckedChange={(on) => update(d, () => (on ? [{ start: "09:00", end: "18:00" }] : []))}
                  aria-label={`${WEEKDAYS[d]} — trabalha neste dia`}
                />
                <span className="text-sm font-medium">{WEEKDAYS[d]}</span>
              </div>
              {open ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {rows.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-lg border bg-muted/30 p-1">
                      <Input
                        type="time"
                        step={900}
                        value={r.start}
                        onChange={(e) => update(d, (rs) => rs.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                        className="h-8 w-[6.5rem]"
                        aria-label={`${WEEKDAYS[d]} intervalo ${i + 1} início`}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        step={900}
                        value={r.end}
                        onChange={(e) => update(d, (rs) => rs.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                        className="h-8 w-[6.5rem]"
                        aria-label={`${WEEKDAYS[d]} intervalo ${i + 1} fim`}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => update(d, (rs) => rs.filter((_, j) => j !== i))}
                        aria-label="Remover intervalo"
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update(d, (rs) => {
                        const last = rs.at(-1);
                        const start = last ? minutesToHHMM(Math.min(hhmmToMinutes(last.end) + 60, 22 * 60)) : "09:00";
                        return [...rs, { start, end: minutesToHHMM(Math.min(hhmmToMinutes(start) + 240, 23 * 60 + 45)) }];
                      })
                    }
                  >
                    <Plus /> Intervalo
                  </Button>
                </div>
              ) : (
                <p className="pt-1.5 text-sm text-muted-foreground">Folga</p>
              )}
            </li>
          );
        })}
      </ul>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Salvar expediente
      </Button>
    </div>
  );
}
