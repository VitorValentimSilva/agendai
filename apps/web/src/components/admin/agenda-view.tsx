"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/site/state";
import { useAdminProfessionals, useAgenda, useMe, type AdminAppointment } from "@/hooks/use-admin";
import {
  addDaysIso,
  DEFAULT_TZ,
  formatLocalDate,
  formatTime,
  fromIsoDate,
  isoDateInTz,
  minutesInTz,
  minutesToHHMM,
  startOfWeekIso,
  todayInTz,
  toIsoDate,
  WEEKDAYS_SHORT,
} from "@/lib/format";
import { STATUS_BLOCK, STATUS_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Schemas } from "@/lib/api/client";
import { PageHeader } from "./page-header";
import { AppointmentDialog } from "./appointment-dialog";
import { ManualAppointmentDialog } from "./manual-appointment-dialog";

type Professional = Schemas["AdminProfessionalDto"];
type TimeOff = Schemas["TimeOffDto"];

const PX_PER_MIN = 1.25; // 75px por hora
const ALL = "all";

interface Column {
  key: string;
  title: string;
  subtitle?: string;
  date: string;
  professional?: Professional;
  isToday: boolean;
}

export function AgendaView() {
  const me = useMe();
  const professionals = useAdminProfessionals();
  const isPro = me.data?.role === "PROFESSIONAL";
  const tz = me.data?.businessTimezone ?? DEFAULT_TZ;
  const today = todayInTz(tz);

  const [view, setView] = useState<"day" | "week">("day");
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<string>(ALL);
  const [showCanceled, setShowCanceled] = useState(false);
  const [selected, setSelected] = useState<AdminAppointment | null>(null);
  const [creating, setCreating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const activePros = (professionals.data ?? []).filter((p) => p.active);
  const ownId = me.data?.professionalId ?? undefined;
  // Semana precisa de um profissional (evita sobreposição de blocos)
  const effectiveFilter = isPro ? ownId : view === "week" && filter === ALL ? activePros[0]?.id : filter === ALL ? undefined : filter;

  const from = view === "day" ? date : startOfWeekIso(date);
  const to = view === "day" ? date : addDaysIso(from, 6);
  const agenda = useAgenda({ from, to, professionalId: effectiveFilter });
  const timezone = agenda.data?.timezone ?? tz;

  const columns: Column[] = (() => {
    if (view === "day") {
      const pros = effectiveFilter ? activePros.filter((p) => p.id === effectiveFilter) : activePros;
      return pros.map((p) => ({ key: p.id, title: p.name, date, professional: p, isToday: date === today }));
    }
    const pro = activePros.find((p) => p.id === effectiveFilter);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDaysIso(from, i);
      return {
        key: d,
        title: `${WEEKDAYS_SHORT[fromIsoDate(d).getDay()]} ${formatLocalDate(d, "dd/MM")}`,
        date: d,
        professional: pro,
        isToday: d === today,
      };
    });
  })();

  // Faixa de horas exibida: do primeiro início ao último fim de expediente (padrão 08–21)
  const [gridStart, gridEnd] = (() => {
    const hours = columns.flatMap((c) => c.professional?.workingHours ?? []);
    if (!hours.length) return [8 * 60, 21 * 60];
    const s = Math.min(...hours.map((h) => h.startMinute));
    const e = Math.max(...hours.map((h) => h.endMinute));
    return [Math.floor(s / 60) * 60, Math.ceil(e / 60) * 60];
  })();
  const height = (gridEnd - gridStart) * PX_PER_MIN;

  const appointments = (agenda.data?.appointments ?? []).filter((a) => showCanceled || a.status !== "CANCELED");

  function shift(direction: number) {
    setDate((d) => addDaysIso(d, direction * (view === "day" ? 1 : 7)));
  }

  const rangeLabel =
    view === "day" ? formatLocalDate(date, "EEEE, d 'de' MMMM") : `${formatLocalDate(from, "d MMM")} – ${formatLocalDate(to, "d MMM yyyy")}`;

  return (
    <>
      <PageHeader
        title="Agenda"
        description={isPro ? "Sua agenda de atendimentos." : "Atendimentos por profissional."}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Novo agendamento
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border">
            <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label={view === "day" ? "Dia anterior" : "Semana anterior"}>
              <ChevronLeft />
            </Button>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="min-w-44 font-medium first-letter:uppercase">
                  <CalendarDays className="text-gold" />
                  <span className="first-letter:uppercase">{rangeLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromIsoDate(date)}
                  onSelect={(d) => {
                    if (d) setDate(toIsoDate(d));
                    setPickerOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label={view === "day" ? "Próximo dia" : "Próxima semana"}>
              <ChevronRight />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDate(today)} disabled={date === today}>
            Hoje
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isPro && (
            <Select value={view === "week" && filter === ALL ? (activePros[0]?.id ?? ALL) : filter} onValueChange={setFilter}>
              <SelectTrigger size="sm" className="min-w-44" aria-label="Filtrar por profissional">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {view === "day" && <SelectItem value={ALL}>Todos os profissionais</SelectItem>}
                {activePros.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-2">
            <Switch id="show-canceled" checked={showCanceled} onCheckedChange={setShowCanceled} />
            <Label htmlFor="show-canceled" className="text-sm font-normal text-muted-foreground">
              Cancelados
            </Label>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as "day" | "week")}>
            <TabsList className="h-9">
              <TabsTrigger value="day" className="text-xs">Dia</TabsTrigger>
              <TabsTrigger value="week" className="text-xs">Semana</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {agenda.isError ? (
        <ErrorState message={agenda.error.message} onRetry={() => void agenda.refetch()} />
      ) : !agenda.data || !professionals.data ? (
        <Skeleton className="h-[560px] w-full rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <div className="min-w-fit" style={{ minWidth: columns.length * (view === "day" ? 180 : 130) + 56 }}>
              {/* Cabeçalho das colunas */}
              <div className="sticky top-0 z-20 flex border-b bg-card">
                <div className="w-14 shrink-0" />
                {columns.map((c) => {
                  const count = appointmentsFor(appointments, c, timezone).filter((a) => a.status !== "CANCELED").length;
                  return (
                    <div key={c.key} className={cn("flex-1 border-l px-3 py-2.5", c.isToday && view === "week" && "bg-gold/5")}>
                      <p className={cn("truncate text-sm font-semibold", c.isToday && view === "week" && "text-gold")}>{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {count} {count === 1 ? "atendimento" : "atendimentos"}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Grade */}
              <div className="relative flex" style={{ height }}>
                <div className="relative w-14 shrink-0">
                  {Array.from({ length: (gridEnd - gridStart) / 60 + 1 }, (_, i) => (
                    <span
                      key={i}
                      className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums"
                      style={{ top: i * 60 * PX_PER_MIN }}
                    >
                      {i === 0 ? "" : minutesToHHMM(gridStart + i * 60)}
                    </span>
                  ))}
                </div>
                {columns.map((c) => (
                  <DayColumn
                    key={c.key}
                    column={c}
                    gridStart={gridStart}
                    gridEnd={gridEnd}
                    timezone={timezone}
                    appointments={appointmentsFor(appointments, c, timezone)}
                    timeOffs={timeOffsFor(agenda.data.timeOffs, c, timezone, gridStart, gridEnd)}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Legend />

      <AppointmentDialog appointment={selected} timezone={timezone} onOpenChange={(o) => !o && setSelected(null)} />
      <ManualAppointmentDialog
        open={creating}
        onOpenChange={setCreating}
        defaultDate={date < today ? today : date}
        defaultProfessionalId={effectiveFilter}
      />
    </>
  );
}

function appointmentsFor(list: AdminAppointment[], c: Column, tz: string) {
  return list.filter((a) => isoDateInTz(a.startsAt, tz) === c.date && (!c.professional || a.professional.id === c.professional.id));
}

function timeOffsFor(list: TimeOff[], c: Column, tz: string, gridStart: number, gridEnd: number) {
  return list
    .filter((t) => t.professionalId === null || t.professionalId === c.professional?.id)
    .map((t) => {
      const startDate = isoDateInTz(t.startsAt, tz);
      const endDate = isoDateInTz(t.endsAt, tz);
      if (endDate < c.date && startDate < c.date) return null;
      if (startDate > c.date) return null;
      const start = startDate < c.date ? gridStart : Math.max(gridStart, minutesInTz(t.startsAt, tz));
      const endMin = minutesInTz(t.endsAt, tz);
      const end = endDate > c.date || (endDate === c.date && endMin === 0 && startDate < c.date) ? gridEnd : Math.min(gridEnd, endMin);
      if (end <= start) return null;
      return { id: t.id, start, end, reason: t.reason, business: t.professionalId === null };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

function DayColumn({
  column,
  gridStart,
  gridEnd,
  timezone,
  appointments,
  timeOffs,
  onSelect,
}: {
  column: Column;
  gridStart: number;
  gridEnd: number;
  timezone: string;
  appointments: AdminAppointment[];
  timeOffs: Array<{ id: string; start: number; end: number; reason: string | null; business: boolean }>;
  onSelect: (a: AdminAppointment) => void;
}) {
  const weekday = fromIsoDate(column.date).getDay();
  const working = (column.professional?.workingHours ?? []).filter((w) => w.weekday === weekday);
  const top = (m: number) => (m - gridStart) * PX_PER_MIN;
  const nowMinute = column.isToday ? minutesInTz(new Date(), timezone) : null;

  return (
    <div className="relative flex-1 border-l">
      {/* Fora do expediente */}
      <div className="absolute inset-0 bg-muted/40 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--border)_6px,var(--border)_7px)]" />
      {working.map((w, i) => (
        <div
          key={i}
          className="absolute inset-x-0 bg-card"
          style={{ top: top(Math.max(w.startMinute, gridStart)), height: (Math.min(w.endMinute, gridEnd) - Math.max(w.startMinute, gridStart)) * PX_PER_MIN }}
        />
      ))}
      {/* Linhas de hora */}
      {Array.from({ length: (gridEnd - gridStart) / 60 }, (_, i) => (
        <div key={i} className="absolute inset-x-0 border-t border-border/60" style={{ top: i * 60 * PX_PER_MIN }}>
          <div className="absolute inset-x-0 top-[37.5px] border-t border-dashed border-border/30" />
        </div>
      ))}
      {/* Bloqueios */}
      {timeOffs.map((t) => (
        <div
          key={t.id}
          className="absolute inset-x-1 flex items-start rounded-md border border-dashed border-muted-foreground/30 bg-muted/80 p-1.5 text-[11px] text-muted-foreground"
          style={{ top: top(t.start), height: (t.end - t.start) * PX_PER_MIN }}
        >
          <span className="line-clamp-2">🔒 {t.reason ?? (t.business ? "Fechado" : "Bloqueado")}</span>
        </div>
      ))}
      {/* Agendamentos */}
      {appointments.map((a) => {
        const start = minutesInTz(a.startsAt, timezone);
        const end = start + (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000;
        const h = (end - start) * PX_PER_MIN;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a)}
            className={cn(
              "absolute inset-x-1 cursor-pointer overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left text-xs shadow-sm transition-colors outline-none focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/60",
              STATUS_BLOCK[a.status],
            )}
            style={{ top: top(start) + 1, height: Math.max(h - 2, 18) }}
            aria-label={`${formatTime(a.startsAt, timezone)} ${a.customer.name}, ${a.service.name}, ${STATUS_LABEL[a.status]}`}
          >
            <p className="truncate font-semibold">
              <span className="tabular-nums">{formatTime(a.startsAt, timezone)}</span> {a.customer.name}
            </p>
            {h > 34 && <p className="truncate text-muted-foreground">{a.service.name}</p>}
          </button>
        );
      })}
      {/* Agora */}
      {nowMinute !== null && nowMinute >= gridStart && nowMinute <= gridEnd && (
        <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: top(nowMinute) }} aria-hidden>
          <span className="-ml-1 size-2 rounded-full bg-destructive" />
          <span className="h-px flex-1 bg-destructive" />
        </div>
      )}
    </div>
  );
}

function Legend() {
  const items: Array<[keyof typeof STATUS_BLOCK, string]> = [
    ["SCHEDULED", STATUS_LABEL.SCHEDULED],
    ["CONFIRMED", STATUS_LABEL.CONFIRMED],
    ["COMPLETED", STATUS_LABEL.COMPLETED],
    ["NO_SHOW", STATUS_LABEL.NO_SHOW],
    ["CANCELED", STATUS_LABEL.CANCELED],
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Legenda">
      {items.map(([status, label]) => (
        <li key={status} className="flex items-center gap-1.5">
          <span className={cn("size-3 rounded-sm border-l-[3px]", STATUS_BLOCK[status])} /> {label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-[repeating-linear-gradient(135deg,transparent,transparent_2px,var(--muted-foreground)_2px,var(--muted-foreground)_3px)] opacity-40" />
        Fora do expediente
      </li>
    </ul>
  );
}
