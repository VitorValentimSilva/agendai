"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { LoaderCircle, Pencil, Plus, Scissors, Timer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState } from "@/components/site/state";
import { useAdminProfessionals, useAdminServices, useInvalidateAdmin } from "@/hooks/use-admin";
import { api, unwrap, type Schemas } from "@/lib/api/client";
import { formatDuration, formatPrice } from "@/lib/format";
import { PageHeader } from "./page-header";

type Service = Schemas["AdminServiceDto"];

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  description: z.string().max(300),
  durationMinutes: z.number({ error: "Informe a duração." }).int().min(5, "Mínimo de 5 min.").max(600),
  price: z.string().regex(/^\d{1,5}([.,]\d{1,2})?$/, "Valor inválido (ex.: 55,00)."),
  active: z.boolean(),
  professionalIds: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

export function ServicesView() {
  const services = useAdminServices();
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const invalidate = useInvalidateAdmin();
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/admin/services/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      toast.success("Serviço removido", { description: "Se já tinha agendamentos, ele foi apenas desativado." });
      void invalidate();
    },
    onError: (e) => toast.error("Não foi possível remover", { description: e.message }),
  });

  return (
    <>
      <PageHeader
        title="Serviços"
        description="O que aparece para o cliente no agendamento online."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus /> Novo serviço
          </Button>
        }
      />
      {services.isError ? (
        <ErrorState message={services.error.message} onRetry={() => void services.refetch()} />
      ) : !services.data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : services.data.length === 0 ? (
        <EmptyState icon={<Scissors className="size-5" />} title="Nenhum serviço cadastrado" action={<Button onClick={() => setEditing("new")}>Criar serviço</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {services.data.map((s) => (
            <Card key={s.id} className="gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{s.name}</h2>
                    {!s.active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description ?? "Sem descrição"}</p>
                </div>
                <p className="font-display text-lg font-semibold whitespace-nowrap text-gold">{formatPrice(s.priceCents)}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Timer className="size-4" /> {formatDuration(s.durationMinutes)}
                  </span>
                  <span>
                    {s.professionalIds.length} {s.professionalIds.length === 1 ? "profissional" : "profissionais"}
                  </span>
                </p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(s)} aria-label={`Editar ${s.name}`}>
                    <Pencil />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Remover ${s.name}`}>
                        <Trash2 />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover “{s.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se já existirem agendamentos com este serviço, ele será apenas desativado para preservar o histórico.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => remove.mutate(s.id)}>
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Novo serviço" : "Editar serviço"}</DialogTitle>
            <DialogDescription>Preço, duração e quem atende.</DialogDescription>
          </DialogHeader>
          {editing !== null && <ServiceForm service={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ServiceForm({ service, onDone }: { service?: Service; onDone: () => void }) {
  const professionals = useAdminProfessionals();
  const invalidate = useInvalidateAdmin();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: service?.name ?? "",
      description: service?.description ?? "",
      durationMinutes: service?.durationMinutes ?? 30,
      price: service ? (service.priceCents / 100).toFixed(2).replace(".", ",") : "",
      active: service?.active ?? true,
      professionalIds: service?.professionalIds ?? [],
    },
  });
  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        name: v.name,
        description: v.description || null,
        durationMinutes: v.durationMinutes,
        priceCents: Math.round(Number(v.price.replace(",", ".")) * 100),
        active: v.active,
        professionalIds: v.professionalIds,
      };
      return service
        ? unwrap(api.PATCH("/admin/services/{id}", { params: { path: { id: service.id } }, body }))
        : unwrap(api.POST("/admin/services", { body }));
    },
    onSuccess: () => {
      toast.success(service ? "Serviço atualizado" : "Serviço criado");
      void invalidate();
      onDone();
    },
    onError: (e) => toast.error("Não foi possível salvar", { description: e.message }),
  });
  const errors = form.formState.errors;
  const selectedPros = useWatch({ control: form.control, name: "professionalIds" });
  const active = useWatch({ control: form.control, name: "active" });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
      <div className="grid gap-2">
        <Label htmlFor="s-name">Nome</Label>
        <Input id="s-name" {...form.register("name")} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="s-desc">Descrição</Label>
        <Textarea id="s-desc" rows={2} {...form.register("description")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="s-duration">Duração (min)</Label>
          <Input id="s-duration" type="number" min={5} step={5} {...form.register("durationMinutes", { valueAsNumber: true })} aria-invalid={!!errors.durationMinutes} />
          {errors.durationMinutes && <p className="text-sm text-destructive">{errors.durationMinutes.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="s-price">Preço (R$)</Label>
          <Input id="s-price" inputMode="decimal" placeholder="55,00" {...form.register("price")} aria-invalid={!!errors.price} />
          {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
        </div>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Quem faz este serviço</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {professionals.data?.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
              <Checkbox
                checked={selectedPros.includes(p.id)}
                onCheckedChange={(checked) =>
                  form.setValue(
                    "professionalIds",
                    checked ? [...selectedPros, p.id] : selectedPros.filter((id) => id !== p.id),
                  )
                }
              />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
        <Label htmlFor="s-active" className="font-normal">
          Disponível para agendamento online
        </Label>
        <Switch id="s-active" checked={active} onCheckedChange={(v) => form.setValue("active", v)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <LoaderCircle className="animate-spin" />} Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}
