"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, LoaderCircle, MessageCircle, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState } from "@/components/site/state";
import { useCustomer, useCustomers, useInvalidateAdmin } from "@/hooks/use-admin";
import { useDebounced } from "@/hooks/use-debounced";
import { api, unwrap } from "@/lib/api/client";
import { DEFAULT_TZ, formatDateShort, formatInTz, formatPrice } from "@/lib/format";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/status";
import { PageHeader } from "./page-header";

export function CustomersView() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const debounced = useDebounced(search.trim());
  const customers = useCustomers({ search: debounced || undefined, page });
  const d = customers.data;
  const totalPages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Clientes" description={d ? `${d.total} clientes cadastrados` : "Quem já agendou com vocês."} />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por nome, WhatsApp ou e-mail"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-9"
          aria-label="Buscar clientes"
        />
      </div>

      {customers.isError ? (
        <ErrorState message={customers.error.message} onRetry={() => void customers.refetch()} />
      ) : !d ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : d.items.length === 0 ? (
        <EmptyState icon={<Users className="size-5" />} title="Nenhum cliente encontrado" message={debounced ? "Tente outro termo de busca." : undefined} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">WhatsApp</TableHead>
                <TableHead className="text-right">Agend.</TableHead>
                <TableHead className="hidden sm:table-cell">Última visita</TableHead>
                <TableHead className="hidden lg:table-cell">Próximo</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Total gasto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => setSelected(c.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(c.id))}
                  aria-label={`Ver histórico de ${c.name}`}
                >
                  <TableCell>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground md:hidden">{formatPhone(c.whatsapp)}</p>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">{formatPhone(c.whatsapp)}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.appointmentsCount}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{c.lastVisitAt ? formatDateShort(c.lastVisitAt) : "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {c.nextAppointmentAt ? <Badge variant="gold">{formatInTz(c.nextAppointmentAt, "dd/MM HH:mm")}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden text-right font-medium tabular-nums sm:table-cell">{formatPrice(c.totalSpentCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              Página {d.page} de {totalPages}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
                <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">{selected && <CustomerDetail id={selected} />}</SheetContent>
      </Sheet>
    </>
  );
}

function CustomerDetail({ id }: { id: string }) {
  const customer = useCustomer(id);
  const invalidate = useInvalidateAdmin();
  const c = customer.data;
  const [notes, setNotes] = useState<string>();
  const save = useMutation({
    mutationFn: () => unwrap(api.PATCH("/admin/customers/{id}", { params: { path: { id } }, body: { notes: notes ?? null } })),
    onSuccess: () => {
      toast.success("Observações salvas");
      void invalidate();
    },
    onError: (e) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  if (!c) {
    return (
      <div className="space-y-3 p-4">
        <SheetTitle className="sr-only">Carregando cliente</SheetTitle>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="text-xl">{c.name}</SheetTitle>
        <SheetDescription>
          {formatPhone(c.whatsapp)}
          {c.email ? ` · ${c.email}` : ""} · cliente desde {formatDateShort(c.createdAt)}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-6 px-4 pb-8">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Agendamentos", String(c.appointmentsCount)],
            ["Total gasto", formatPrice(c.totalSpentCents)],
            ["Última", c.lastVisitAt ? formatDateShort(c.lastVisitAt) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <Button asChild variant="outline" className="w-full">
          <a href={whatsappLink(c.whatsapp, `Olá, ${c.name.split(" ")[0]}!`)} target="_blank" rel="noreferrer">
            <MessageCircle /> Conversar no WhatsApp
          </a>
        </Button>
        <div className="grid gap-2">
          <Label htmlFor="c-notes">Observações internas</Label>
          <Textarea id="c-notes" rows={3} defaultValue={c.notes ?? ""} onChange={(e) => setNotes(e.target.value)} placeholder="Preferências, alergias..." />
          <Button size="sm" variant="secondary" className="justify-self-end" disabled={notes === undefined || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <LoaderCircle className="animate-spin" />} Salvar observações
          </Button>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Histórico</h3>
          {c.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem agendamentos.</p>
          ) : (
            <ol className="space-y-2">
              {c.history.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm">
                  <div className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatInTz(a.startsAt, "dd/MM/yy", DEFAULT_TZ)}
                    <br />
                    {formatInTz(a.startsAt, "HH:mm", DEFAULT_TZ)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.service.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.professional.name} · {formatPrice(a.priceCents)}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
