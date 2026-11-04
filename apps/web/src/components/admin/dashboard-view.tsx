"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowRight, CalendarCheck, CalendarDays, CalendarX, TrendingUp, UserX, Wallet } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { EmptyState, ErrorState } from "@/components/site/state";
import { useDashboard, useMe, type AdminAppointment } from "@/hooks/use-admin";
import { formatInTz, formatLocalDate, formatPrice, formatTime } from "@/lib/format";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/status";
import { PageHeader } from "./page-header";
import { BookingLinkCard } from "./booking-link-card";
import { AppointmentDialog } from "./appointment-dialog";

const chartConfig = {
  appointments: { label: "Agendamentos", color: "var(--chart-1)" },
  revenueCents: { label: "Faturamento", color: "var(--chart-1)" },
} satisfies ChartConfig;

const pct = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function DashboardView() {
  const me = useMe();
  const dashboard = useDashboard();
  const [metric, setMetric] = useState<"appointments" | "revenueCents">("appointments");
  const [selected, setSelected] = useState<AdminAppointment | null>(null);
  const d = dashboard.data;
  const tz = d?.timezone ?? "America/Sao_Paulo";
  const firstName = me.data?.name.split(" ")[0];

  if (dashboard.isError) return <ErrorState message={dashboard.error.message} onRetry={() => void dashboard.refetch()} />;

  const cards = d
    ? [
        { label: "Agendamentos hoje", value: String(d.appointmentsToday), icon: CalendarCheck, hint: formatLocalDate(d.today, "EEEE, d 'de' MMM") },
        { label: "Nesta semana", value: String(d.appointmentsWeek), icon: CalendarDays, hint: "segunda a domingo" },
        { label: "Faturamento previsto", value: formatPrice(d.expectedRevenueMonthCents), icon: TrendingUp, hint: "neste mês" },
        { label: "Faturamento realizado", value: formatPrice(d.realizedRevenueMonthCents), icon: Wallet, hint: "concluídos no mês" },
        { label: "Cancelamentos", value: pct(d.cancellationRate), icon: CalendarX, hint: "últimos 30 dias" },
        { label: "Faltas", value: pct(d.noShowRate), icon: UserX, hint: "últimos 30 dias" },
      ]
    : [];
  const maxTop = Math.max(1, ...(d?.topServices.map((s) => s.count) ?? [1]));

  return (
    <>
      <PageHeader
        title={firstName ? `Olá, ${firstName}` : "Visão geral"}
        description={me.data?.role === "PROFESSIONAL" ? "Seus números e próximos atendimentos." : "Como está o movimento da barbearia."}
        actions={
          <Button asChild>
            <Link href="/admin/agenda">
              <CalendarDays /> Abrir agenda
            </Link>
          </Button>
        }
      />

      {me.data?.role === "OWNER" && (
        <div className="mb-4">
          <BookingLinkCard slug={me.data.businessSlug} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-6">
        {d
          ? cards.map((c) => (
              <Card key={c.label} className="gap-2 py-4 sm:py-5">
                <CardContent className="px-4 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground sm:text-sm">{c.label}</p>
                    <c.icon className="size-4 shrink-0 text-gold" />
                  </div>
                  <p className="mt-2 font-display text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{c.value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground first-letter:uppercase">{c.hint}</p>
                </CardContent>
              </Card>
            ))
          : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-1.5">
              <CardTitle>Últimos 30 dias</CardTitle>
              <CardDescription>{metric === "appointments" ? "Agendamentos por dia (exceto cancelados)" : "Faturamento realizado por dia"}</CardDescription>
            </div>
            <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
              <TabsList className="h-9">
                <TabsTrigger value="appointments" className="text-xs">Agendamentos</TabsTrigger>
                <TabsTrigger value="revenueCents" className="text-xs">Faturamento</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {d ? (
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                <BarChart data={d.series} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tickFormatter={(v: string) => formatLocalDate(v, "dd/MM")}
                  />
                  <YAxis
                    width={metric === "revenueCents" ? 64 : 32}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tickFormatter={(v: number) => (metric === "revenueCents" ? `R$${Math.round(v / 100)}` : String(v))}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) => formatLocalDate(String(label), "EEE, dd/MM")}
                        valueFormatter={(v, key) => (key === "revenueCents" ? formatPrice(Number(v)) : String(v))}
                      />
                    }
                  />
                  <Bar dataKey={metric} fill={`var(--color-${metric})`} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ChartContainer>
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Serviços mais vendidos</CardTitle>
            <CardDescription>Concluídos nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {!d ? (
              <Skeleton className="h-48 w-full" />
            ) : d.topServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda sem atendimentos concluídos.</p>
            ) : (
              <ul className="space-y-4">
                {d.topServices.map((s) => (
                  <li key={s.serviceId}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {s.count}× · {formatPrice(s.revenueCents)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold" style={{ width: `${(s.count / maxTop) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Próximos agendamentos</CardTitle>
          <CardDescription>Clique para ver detalhes, confirmar ou lembrar o cliente</CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/agenda">
                Ver agenda <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {!d ? (
            <Skeleton className="h-40 w-full" />
          ) : d.upcoming.length === 0 ? (
            <EmptyState icon={<CalendarDays className="size-5" />} title="Nenhum agendamento futuro" />
          ) : (
            <ul className="divide-y">
              {d.upcoming.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(a)}
                    className="flex w-full cursor-pointer items-center gap-4 rounded-lg px-2 py-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-xs text-muted-foreground uppercase">{formatInTz(a.startsAt, "EEE", tz)}</p>
                      <p className="font-display text-lg font-semibold tabular-nums">{formatTime(a.startsAt, tz)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.customer.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {a.service.name} · {a.professional.name} · {formatInTz(a.startsAt, "dd/MM", tz)}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[a.status]} className="hidden sm:inline-flex">
                      {STATUS_LABEL[a.status]}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AppointmentDialog appointment={selected} timezone={tz} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}
