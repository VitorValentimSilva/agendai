"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, HandCoins, TrendingUp, UserX, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/site/state";
import { useMe, useReport } from "@/hooks/use-admin";
import { addDaysIso, DEFAULT_TZ, formatLocalDate, formatPrice, todayInTz } from "@/lib/format";
import { PageHeader } from "./page-header";

type Preset = "month" | "last-month" | "30d" | "custom";

function presetRange(preset: Exclude<Preset, "custom">, today: string): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const pad = (n: number) => String(n).padStart(2, "0");
  if (preset === "month") return { from: `${y}-${pad(m)}-01`, to: today };
  if (preset === "last-month") {
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    const last = new Date(py, pm, 0).getDate();
    return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(last)}` };
  }
  return { from: addDaysIso(today, -29), to: today };
}

export function ReportsView() {
  const me = useMe();
  const today = todayInTz(me.data?.businessTimezone ?? DEFAULT_TZ);
  const [preset, setPreset] = useState<Preset>("month");
  const [custom, setCustom] = useState(() => presetRange("month", today));
  const range = preset === "custom" ? custom : presetRange(preset, today);
  const report = useReport(range);
  const r = report.data;
  const csvHref = `/api/admin/reports/appointments.csv?from=${range.from}&to=${range.to}`;
  const isPro = me.data?.role === "PROFESSIONAL";

  return (
    <>
      <PageHeader
        title="Relatórios"
        description={`${formatLocalDate(range.from, "dd/MM/yyyy")} a ${formatLocalDate(range.to, "dd/MM/yyyy")}${isPro ? " · sua agenda" : ""}`}
        actions={
          <Button asChild variant="outline">
            <a href={csvHref} download>
              <Download /> Exportar CSV
            </a>
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Tabs value={preset} onValueChange={(v) => setPreset(v as Preset)}>
          <TabsList className="h-9">
            <TabsTrigger value="month" className="text-xs">Este mês</TabsTrigger>
            <TabsTrigger value="last-month" className="text-xs">Mês passado</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs">30 dias</TabsTrigger>
            <TabsTrigger value="custom" className="text-xs">Período</TabsTrigger>
          </TabsList>
        </Tabs>
        {preset === "custom" && (
          <div className="flex items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="r-from" className="text-xs">De</Label>
              <Input id="r-from" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-9" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="r-to" className="text-xs">Até</Label>
              <Input id="r-to" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-9" />
            </div>
          </div>
        )}
      </div>

      {report.isError ? (
        <ErrorState message={report.error.message} onRetry={() => void report.refetch()} />
      ) : !r ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: "Faturamento", value: formatPrice(r.totals.revenueCents), hint: `${r.totals.completed} atendimentos concluídos`, icon: TrendingUp },
              { label: isPro ? "Sua comissão" : "Comissões", value: formatPrice(r.totals.commissionCents), hint: "sobre concluídos", icon: HandCoins },
              { label: "Receita líquida", value: formatPrice(r.totals.netRevenueCents), hint: "faturamento − comissões", icon: Wallet },
              { label: "Faltas", value: String(r.totals.noShows), hint: `${r.totals.canceled} cancelamentos`, icon: UserX },
            ].map((c) => (
              <Card key={c.label} className="gap-2 py-4 sm:py-5">
                <CardContent className="px-4 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground sm:text-sm">{c.label}</p>
                    <c.icon className="size-4 shrink-0 text-gold" />
                  </div>
                  <p className="mt-2 font-display text-xl font-semibold tabular-nums sm:text-2xl">{c.value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{c.hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-4 gap-0 overflow-hidden py-0">
            <CardHeader className="py-5">
              <CardTitle>Por profissional</CardTitle>
              <CardDescription>Comissão calculada sobre atendimentos concluídos no período</CardDescription>
            </CardHeader>
            {r.professionals.length === 0 ? (
              <CardContent className="pb-6">
                <EmptyState icon={<FileSpreadsheet className="size-5" />} title="Sem atendimentos no período" />
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Profissional</TableHead>
                    <TableHead className="text-right">Concluídos</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Faltas</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Ticket médio</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.professionals.map((p) => (
                    <TableRow key={p.professionalId}>
                      <TableCell className="font-medium">{p.professionalName}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.completed}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{p.noShows}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{formatPrice(p.averageTicketCents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPrice(p.revenueCents)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-medium text-gold">{formatPrice(p.commissionCents)}</span>
                        <span className="ml-1 text-xs text-muted-foreground">({p.commissionPercent}%)</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          {r.services.length > 0 && (
            <Card className="mt-4 gap-0 overflow-hidden py-0">
              <CardHeader className="py-5">
                <CardTitle>Por serviço</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-right">Concluídos</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.services.map((s) => (
                    <TableRow key={s.serviceId}>
                      <TableCell>{s.serviceName}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.completed}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPrice(s.revenueCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </>
  );
}
