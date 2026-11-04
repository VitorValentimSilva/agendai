"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, MessageCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/site/state";
import { useInvalidateAdmin, useWaitlist } from "@/hooks/use-admin";
import { api, unwrap } from "@/lib/api/client";
import { formatInTz, formatLocalDate } from "@/lib/format";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { PageHeader } from "./page-header";

type Status = "ACTIVE" | "NOTIFIED" | "BOOKED" | "CANCELED" | "ALL";

const STATUS: Record<Exclude<Status, "ALL">, { label: string; variant: "info" | "warning" | "success" | "secondary" }> = {
  ACTIVE: { label: "Aguardando", variant: "info" },
  NOTIFIED: { label: "Avisado", variant: "warning" },
  BOOKED: { label: "Agendou", variant: "success" },
  CANCELED: { label: "Saiu", variant: "secondary" },
};

export function WaitlistView() {
  const [status, setStatus] = useState<Status>("ACTIVE");
  const list = useWaitlist(status);
  const invalidate = useInvalidateAdmin();
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/admin/waitlist/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      toast.success("Removido da fila");
      void invalidate();
    },
    onError: (e) => toast.error("Não foi possível remover", { description: e.message }),
  });

  return (
    <>
      <PageHeader
        title="Fila de espera"
        description="Clientes que querem um horário em dias lotados. Quando alguém cancela, avisamos pelo WhatsApp automaticamente."
      />
      <Tabs value={status} onValueChange={(v) => setStatus(v as Status)} className="mb-4">
        <TabsList className="h-9">
          <TabsTrigger value="ACTIVE" className="text-xs">Aguardando</TabsTrigger>
          <TabsTrigger value="NOTIFIED" className="text-xs">Avisados</TabsTrigger>
          <TabsTrigger value="BOOKED" className="text-xs">Agendaram</TabsTrigger>
          <TabsTrigger value="ALL" className="text-xs">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      {list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={<BellRing className="size-5" />}
          title="Ninguém na fila"
          message="Quando um dia estiver lotado, o cliente pode entrar na fila pelo site de agendamento."
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Serviço</TableHead>
                <TableHead className="hidden lg:table-cell">Profissional</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium whitespace-nowrap first-letter:uppercase">{formatLocalDate(e.date, "EEE, dd/MM")}</TableCell>
                  <TableCell>
                    <p className="font-medium">{e.customerName}</p>
                    <p className="text-xs text-muted-foreground">{formatPhone(e.customerWhatsapp)}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{e.serviceName}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{e.professionalName ?? "Qualquer"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS[e.status].variant}>{STATUS[e.status].label}</Badge>
                    {e.notifiedAt && <p className="mt-1 text-xs text-muted-foreground">{formatInTz(e.notifiedAt, "dd/MM HH:mm")}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`WhatsApp de ${e.customerName}`}>
                        <a href={whatsappLink(e.customerWhatsapp, `Olá, ${e.customerName.split(" ")[0]}!`)} target="_blank" rel="noreferrer">
                          <MessageCircle />
                        </a>
                      </Button>
                      {(e.status === "ACTIVE" || e.status === "NOTIFIED") && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remover ${e.customerName} da fila`}
                          onClick={() => remove.mutate(e.id)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
