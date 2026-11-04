"use client";

import { useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/site/state";
import { useBusinessSettings, useInvalidateAdmin } from "@/hooks/use-admin";
import { api, unwrap, type Schemas } from "@/lib/api/client";
import { formatPhone, isValidPhone, maskPhone } from "@/lib/phone";
import { PageHeader } from "./page-header";
import { TimeOffManager } from "./time-off-manager";
import { AutomationSettings } from "./automation-settings";

const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Belem", "America/Fortaleza", "America/Recife", "America/Bahia", "America/Rio_Branco", "America/Noronha"];

const int = (min: number, max: number) => z.number({ error: "Informe um número." }).int().min(min, `Mínimo ${min}.`).max(max, `Máximo ${max}.`);
const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  description: z.string().max(400),
  phone: z.string().refine((v) => v.replace(/\D/g, "").length >= 10, "Telefone inválido."),
  whatsapp: z.string().refine(isValidPhone, "WhatsApp inválido."),
  email: z.union([z.literal(""), z.email("E-mail inválido.")]),
  instagram: z.string().max(60),
  addressLine: z.string().trim().min(3, "Informe o endereço."),
  city: z.string().trim().min(2, "Informe a cidade."),
  state: z.string().trim().length(2, "Use a sigla (ex.: SP)."),
  timezone: z.string(),
  slotIntervalMinutes: int(5, 120),
  minAdvanceMinutes: int(0, 10080),
  maxAdvanceDays: int(1, 365),
  cancellationPolicyHours: int(0, 168),
});
type Values = z.infer<typeof schema>;

export function SettingsView() {
  const settings = useBusinessSettings();
  if (settings.isError) return <ErrorState message={settings.error.message} onRetry={() => void settings.refetch()} />;
  return (
    <>
      <PageHeader title="Configurações" description="Dados do negócio e regras do agendamento online." />
      {settings.data ? (
        <>
          <SettingsForm initial={settings.data} />
          <AutomationSettings key={settings.data.hasMercadoPagoToken ? "t" : "f"} initial={settings.data} />
        </>
      ) : (
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      )}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Feriados e fechamentos</CardTitle>
          <CardDescription>Bloqueia a agenda de todos os profissionais no período.</CardDescription>
        </CardHeader>
        <CardContent>
          <TimeOffManager professionalId={null} timezone={settings.data?.timezone} />
        </CardContent>
      </Card>
    </>
  );
}

function SettingsForm({ initial }: { initial: Schemas["BusinessSettingsDto"] }) {
  const invalidate = useInvalidateAdmin();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial.name,
      description: initial.description ?? "",
      phone: initial.phone,
      whatsapp: formatPhone(initial.whatsapp),
      email: initial.email ?? "",
      instagram: initial.instagram ?? "",
      addressLine: initial.addressLine,
      city: initial.city,
      state: initial.state,
      timezone: initial.timezone,
      slotIntervalMinutes: initial.slotIntervalMinutes,
      minAdvanceMinutes: initial.minAdvanceMinutes,
      maxAdvanceDays: initial.maxAdvanceDays,
      cancellationPolicyHours: initial.cancellationPolicyHours,
    },
  });
  const save = useMutation({
    mutationFn: (v: Values) =>
      unwrap(api.PATCH("/admin/business", { body: { ...v, description: v.description || null, email: v.email || null, instagram: v.instagram || null } })),
    onSuccess: (data) => {
      toast.success("Configurações salvas");
      form.reset({ ...form.getValues(), whatsapp: formatPhone(data.whatsapp) });
      void invalidate();
    },
    onError: (e) => toast.error("Não foi possível salvar", { description: e.message }),
  });
  const e = form.formState.errors;
  const timezone = useWatch({ control: form.control, name: "timezone" });
  const field = (name: keyof Values, label: string, props: React.ComponentProps<typeof Input> = {}, hint?: string) => (
    <div className="grid gap-2">
      <Label htmlFor={`b-${name}`}>{label}</Label>
      <Input
        id={`b-${name}`}
        aria-invalid={!!e[name]}
        {...form.register(name, {
          valueAsNumber: props.type === "number",
          ...(name === "whatsapp" ? { onChange: (ev) => form.setValue("whatsapp", maskPhone(ev.target.value)) } : {}),
        })}
        {...props}
      />
      {e[name] ? <p className="text-sm text-destructive">{e[name]?.message}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Dados do negócio</CardTitle>
          <CardDescription>Aparecem na página pública e nas mensagens.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {field("name", "Nome")}
          <div className="grid gap-2">
            <Label htmlFor="b-description">Descrição</Label>
            <Textarea id="b-description" rows={3} {...form.register("description")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("phone", "Telefone", { inputMode: "tel" })}
            {field("whatsapp", "WhatsApp", { inputMode: "tel" })}
            {field("email", "E-mail", { type: "email" })}
            {field("instagram", "Instagram", { placeholder: "seu.perfil" })}
          </div>
          {field("addressLine", "Endereço")}
          <div className="grid grid-cols-[1fr_6rem] gap-4">
            {field("city", "Cidade")}
            {field("state", "UF", { maxLength: 2, className: "uppercase" })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras do agendamento</CardTitle>
          <CardDescription>Valem para o agendamento online dos clientes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="b-timezone">Fuso horário</Label>
            <Select value={timezone} onValueChange={(v) => form.setValue("timezone", v, { shouldDirty: true })}>
              <SelectTrigger id="b-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace("America/", "").replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("slotIntervalMinutes", "Intervalo entre horários (min)", { type: "number", min: 5, step: 5 }, "Ex.: 15 → 09:00, 09:15, 09:30...")}
            {field("minAdvanceMinutes", "Antecedência mínima (min)", { type: "number", min: 0, step: 15 }, "Evita agendamentos em cima da hora.")}
            {field("maxAdvanceDays", "Máximo de dias à frente", { type: "number", min: 1 })}
            {field("cancellationPolicyHours", "Prazo para cancelar (h)", { type: "number", min: 0 }, "Pelo link do cliente, até X horas antes.")}
          </div>
          <div className="mt-2 flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Salvar configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
