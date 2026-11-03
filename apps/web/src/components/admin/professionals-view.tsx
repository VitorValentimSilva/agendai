"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, Plus, Settings2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState } from "@/components/site/state";
import { useAdminProfessionals, useAdminServices, useInvalidateAdmin } from "@/hooks/use-admin";
import { api, unwrap, type Schemas } from "@/lib/api/client";
import { initials, minutesToHHMM, WEEKDAYS_SHORT } from "@/lib/format";
import { PageHeader } from "./page-header";
import { WorkingHoursEditor } from "./working-hours-editor";
import { TimeOffManager } from "./time-off-manager";

type Professional = Schemas["AdminProfessionalDto"];

function summarizeHours(p: Professional): string {
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => p.workingHours.some((w) => w.weekday === d));
  if (!days.length) return "Sem expediente";
  const first = p.workingHours.filter((w) => w.weekday === days[0]);
  const span = `${minutesToHHMM(Math.min(...first.map((w) => w.startMinute)))}–${minutesToHHMM(Math.max(...first.map((w) => w.endMinute)))}`;
  return `${days.map((d) => WEEKDAYS_SHORT[d]).join(", ")} · ${span}`;
}

export function ProfessionalsView() {
  const pros = useAdminProfessionals();
  const services = useAdminServices();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const editing = editingId === "new" ? undefined : pros.data?.find((p) => p.id === editingId);

  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Equipe, serviços que cada um faz, expediente e bloqueios."
        actions={
          <Button onClick={() => setEditingId("new")}>
            <Plus /> Novo profissional
          </Button>
        }
      />
      {pros.isError ? (
        <ErrorState message={pros.error.message} onRetry={() => void pros.refetch()} />
      ) : !pros.data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : pros.data.length === 0 ? (
        <EmptyState icon={<UsersRound className="size-5" />} title="Nenhum profissional cadastrado" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pros.data.map((p) => (
            <Card key={p.id} className="gap-4 p-5">
              <div className="flex items-start gap-3">
                <Avatar className="size-12 ring-2 ring-gold/30">
                  {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt="" />}
                  <AvatarFallback className="bg-gold/15 font-display text-gold">{initials(p.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold">{p.name}</h2>
                    {!p.active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.bio ?? "Sem descrição"}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="text-muted-foreground">{summarizeHours(p)}</p>
                <div className="flex flex-wrap gap-1">
                  {p.serviceIds.map((id) => (
                    <Badge key={id} variant="gold">
                      {services.data?.find((s) => s.id === id)?.name ?? "…"}
                    </Badge>
                  ))}
                </div>
                {p.userEmail && <p className="text-xs text-muted-foreground">Acesso ao painel: {p.userEmail}</p>}
              </div>
              <Button variant="outline" size="sm" className="mt-auto" onClick={() => setEditingId(p.id)}>
                <Settings2 /> Gerenciar
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={editingId !== null} onOpenChange={(o) => !o && setEditingId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="border-b">
            <SheetTitle>{editingId === "new" ? "Novo profissional" : editing?.name}</SheetTitle>
            <SheetDescription>{editingId === "new" ? "Depois de criar, configure o expediente." : "Dados, expediente e bloqueios."}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-8">
            {editingId === "new" ? (
              <ProfessionalForm onSaved={(p) => setEditingId(p.id)} />
            ) : editing ? (
              <Tabs defaultValue="dados" key={editing.id}>
                <TabsList className="mb-4 w-full">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="expediente">Expediente</TabsTrigger>
                  <TabsTrigger value="bloqueios">Bloqueios</TabsTrigger>
                </TabsList>
                <TabsContent value="dados">
                  <ProfessionalForm professional={editing} onSaved={() => undefined} />
                </TabsContent>
                <TabsContent value="expediente">
                  <WorkingHoursEditor professionalId={editing.id} initial={editing.workingHours} />
                </TabsContent>
                <TabsContent value="bloqueios">
                  <TimeOffManager professionalId={editing.id} />
                </TabsContent>
              </Tabs>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ProfessionalForm({ professional, onSaved }: { professional?: Professional; onSaved: (p: Professional) => void }) {
  const services = useAdminServices();
  const invalidate = useInvalidateAdmin();
  const [name, setName] = useState(professional?.name ?? "");
  const [bio, setBio] = useState(professional?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(professional?.avatarUrl ?? "");
  const [active, setActive] = useState(professional?.active ?? true);
  const [serviceIds, setServiceIds] = useState<string[]>(professional?.serviceIds ?? []);

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), bio: bio.trim() || null, avatarUrl: avatarUrl.trim() || null, active, serviceIds };
      return professional
        ? unwrap(api.PATCH("/admin/professionals/{id}", { params: { path: { id: professional.id } }, body }))
        : unwrap(api.POST("/admin/professionals", { body }));
    },
    onSuccess: (p) => {
      toast.success(professional ? "Dados salvos" : "Profissional criado");
      void invalidate();
      onSaved(p);
    },
    onError: (e) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim().length < 2) return toast.error("Informe o nome.");
        save.mutate();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="p-name">Nome</Label>
        <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="p-bio">Descrição</Label>
        <Textarea id="p-bio" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="p-avatar">
          Foto (URL) <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="p-avatar" type="url" placeholder="https://..." value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Serviços que faz</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.data?.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
              <Checkbox
                checked={serviceIds.includes(s.id)}
                onCheckedChange={(c) => setServiceIds((ids) => (c ? [...ids, s.id] : ids.filter((x) => x !== s.id)))}
              />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
        <Label htmlFor="p-active" className="font-normal">
          Ativo (aparece no agendamento online)
        </Label>
        <Switch id="p-active" checked={active} onCheckedChange={setActive} />
      </div>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending && <LoaderCircle className="animate-spin" />} {professional ? "Salvar dados" : "Criar profissional"}
      </Button>
    </form>
  );
}
