"use client";

import { useEffect, useMemo } from "react";
import { addDays } from "date-fns";
import { CalendarX, Moon, Sun, Sunrise } from "lucide-react";
import { motion } from "motion/react";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/site/state";
import { useAvailableDays, useSlots } from "@/hooks/use-public";
import { formatLocalDate, fromIsoDate, toIsoDate, todayInTz } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Schemas } from "@/lib/api/client";
import { WaitlistDialog } from "./waitlist-dialog";

export type Slot = Schemas["SlotDto"];

const PERIODS = [
  { key: "manha", label: "Manhã", icon: Sunrise, test: (h: number) => h < 12 },
  { key: "tarde", label: "Tarde", icon: Sun, test: (h: number) => h >= 12 && h < 18 },
  { key: "noite", label: "Noite", icon: Moon, test: (h: number) => h >= 18 },
] as const;

export function DateSlotPicker({
  serviceId,
  professionalId,
  timezone,
  maxAdvanceDays,
  date,
  onDateChange,
  slot,
  onSlotChange,
  excludeStart,
  openWeekdays,
  allowWaitlist = false,
}: {
  serviceId: string;
  professionalId: string;
  timezone: string;
  maxAdvanceDays: number;
  date: string | undefined;
  onDateChange: (date: string) => void;
  slot: Slot | undefined;
  onSlotChange: (slot: Slot) => void;
  /** Horário atual (remarcação) — não é oferecido como opção. */
  excludeStart?: string;
  /**
   * Dias da semana em que o negócio abre. Quando informado, dias lotados continuam clicáveis
   * (para oferecer a fila de espera) e só dias fechados/fora da janela ficam desabilitados.
   */
  openWeekdays?: Set<number>;
  /** Mostra "Entrar na fila de espera" quando a data escolhida está lotada. */
  allowWaitlist?: boolean;
}) {
  const today = todayInTz(timezone);
  const lastDay = toIsoDate(addDays(fromIsoDate(today), maxAdvanceDays));
  const days = useAvailableDays({ serviceId, professionalId, from: today, to: lastDay });
  const available = useMemo(() => new Set(days.data?.days ?? []), [days.data]);
  const slots = useSlots({ serviceId, professionalId, date });

  // Seleciona automaticamente o primeiro dia com horário (se nenhuma data foi escolhida)
  useEffect(() => {
    if (!days.data || date) return;
    const first = days.data.days[0];
    if (first) onDateChange(first);
  }, [days.data, date, onDateChange]);

  const isDisabled = (d: Date) => {
    const iso = toIsoDate(d);
    if (!openWeekdays) return !available.has(iso);
    return iso < today || iso > lastDay || !openWeekdays.has(d.getDay());
  };
  const isFull = (d: Date) => Boolean(openWeekdays) && !available.has(toIsoDate(d)) && !isDisabled(d);

  const visibleSlots = (slots.data?.slots ?? []).filter((s) => s.start !== excludeStart);
  const groups = PERIODS.map((p) => ({
    ...p,
    slots: visibleSlots.filter((s) => p.test(Number(s.time.slice(0, 2)))),
  })).filter((g) => g.slots.length > 0);

  if (days.isError) {
    return <ErrorState message={days.error.message} onRetry={() => void days.refetch()} />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-sm rounded-2xl border bg-card p-1 sm:p-2 lg:mx-0">
        {days.isLoading ? (
          <div className="space-y-3 p-3">
            <Skeleton className="mx-auto h-6 w-40" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Calendar
            mode="single"
            className="w-full [--cell-size:--spacing(10.5)]"
            classNames={{ root: "w-full" }}
            selected={date ? fromIsoDate(date) : undefined}
            onSelect={(d) => d && onDateChange(toIsoDate(d))}
            startMonth={fromIsoDate(today)}
            endMonth={fromIsoDate(lastDay)}
            defaultMonth={date ? fromIsoDate(date) : fromIsoDate(today)}
            disabled={isDisabled}
            modifiers={{ full: isFull }}
            modifiersClassNames={{ full: "[&>button]:text-muted-foreground [&>button]:line-through [&>button]:decoration-muted-foreground/50" }}
            showOutsideDays={false}
            aria-label="Escolha a data"
          />
        )}
      </div>

      <div className="min-w-0">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-medium first-letter:uppercase">{date ? formatLocalDate(date) : "Escolha uma data"}</h3>
          {slots.data && <span className="text-xs text-muted-foreground">{visibleSlots.length} horários</span>}
        </div>

        {!date || slots.isLoading || days.isLoading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-11 rounded-lg" />
            ))}
          </div>
        ) : slots.isError ? (
          <ErrorState message={slots.error.message} onRetry={() => void slots.refetch()} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<CalendarX className="size-5" />}
            title={available.size === 0 ? "Sem horários nos próximos dias" : "Nenhum horário livre nesta data"}
            message={
              allowWaitlist
                ? "Entre na fila de espera: avisamos pelo WhatsApp se alguém cancelar."
                : available.size === 0
                  ? "Tente outro profissional ou fale com a gente pelo WhatsApp."
                  : "Escolha outro dia no calendário."
            }
            action={allowWaitlist && date ? <WaitlistDialog serviceId={serviceId} professionalId={professionalId} date={date} /> : undefined}
          />
        ) : (
          <div className="space-y-5" role="radiogroup" aria-label="Horários disponíveis">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <g.icon className="size-3.5" /> {g.label}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
                  {g.slots.map((s, i) => {
                    const selected = slot?.start === s.start;
                    return (
                      <motion.button
                        key={s.start}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.18, delay: Math.min(i * 0.012, 0.2) }}
                        onClick={() => onSlotChange(s)}
                        className={cn(
                          "h-11 cursor-pointer rounded-lg border text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                          selected
                            ? "border-primary bg-primary text-primary-foreground shadow-md shadow-gold/20"
                            : "bg-card hover:border-gold/60 hover:bg-gold/5",
                        )}
                      >
                        {s.time}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
