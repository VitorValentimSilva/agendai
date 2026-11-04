"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  LoaderCircle,
  Scissors,
  ShieldCheck,
  Shuffle,
  Timer,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState, ErrorState } from "@/components/site/state";
import { useBusiness, useServiceProfessionals, useServices } from "@/hooks/use-public";
import { api, ApiError, unwrap } from "@/lib/api/client";
import { formatDateLong, formatDuration, formatPrice, formatTime, initials } from "@/lib/format";
import { isValidPhone, maskPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Stepper } from "./stepper";
import { DateSlotPicker, type Slot } from "./date-slot-picker";

const STEPS = ["Serviço", "Profissional", "Data e hora", "Seus dados", "Confirmar"];
const ANY = "any";

const customerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80, "Nome muito longo."),
  whatsapp: z.string().refine(isValidPhone, "Informe um WhatsApp válido com DDD."),
  email: z.union([z.literal(""), z.email("E-mail inválido.")]),
  notes: z.string().max(500, "Máximo de 500 caracteres."),
});
type CustomerForm = z.infer<typeof customerSchema>;

export function BookingFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const business = useBusiness();
  const services = useServices();

  // Pré-seleção vinda da página do negócio (?servico=...)
  // Pré-seleção vinda da página do negócio ou do aviso da fila de espera
  // (?servico=...&profissional=...&data=AAAA-MM-DD)
  const preselected = params.get("servico") ?? undefined;
  const preProfessional = preselected ? (params.get("profissional") ?? undefined) : undefined;
  const preDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get("data") ?? "") ? params.get("data")! : undefined;
  const [rawStep, setStep] = useState(preselected ? (preProfessional || preDate ? 2 : 1) : 0);
  const [direction, setDirection] = useState(1);
  const [serviceId, setServiceId] = useState<string | undefined>(preselected);
  const [professionalId, setProfessionalId] = useState<string | undefined>(preselected && preDate ? (preProfessional ?? "any") : preProfessional);
  const [date, setDate] = useState<string | undefined>(preDate);
  const [slot, setSlot] = useState<Slot>();
  const [customer, setCustomer] = useState<CustomerForm>();

  const professionals = useServiceProfessionals(serviceId);
  const service = services.data?.find((s) => s.id === serviceId);
  const professional = professionals.data?.find((p) => p.id === professionalId);
  const tz = business.data?.timezone ?? "America/Sao_Paulo";
  // Serviço inválido na URL: volta para a primeira etapa
  const step = rawStep > 0 && services.data && !service ? 0 : rawStep;

  const go = useCallback((next: number) => {
    setStep((current) => {
      setDirection(next > current ? 1 : -1);
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", whatsapp: "", email: "", notes: "" },
    mode: "onTouched",
  });

  const book = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/appointments", {
          body: {
            serviceId: serviceId!,
            professionalId: professionalId!,
            startsAt: slot!.start,
            customer: { name: customer!.name, whatsapp: customer!.whatsapp, ...(customer!.email ? { email: customer!.email } : {}) },
            ...(customer!.notes ? { notes: customer!.notes } : {}),
          },
        }),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(["appointment", data.manageToken], data);
      router.push(`/agendar/sucesso/${data.manageToken}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error("Esse horário acabou de ser ocupado", { description: error.message });
        setSlot(undefined);
        void queryClient.invalidateQueries({ queryKey: ["slots"] });
        void queryClient.invalidateQueries({ queryKey: ["available-days"] });
        go(2);
      } else {
        toast.error("Não foi possível agendar", { description: error.message });
      }
    },
  });

  // Mesmo cálculo da API (sinal arredondado para cima)
  const pixAmount = (() => {
    const b = business.data;
    if (!b || !service || b.paymentMode === "NONE" || service.priceCents <= 0) return 0;
    if (b.paymentMode === "FULL") return service.priceCents;
    return Math.max(1, Math.ceil((service.priceCents * b.depositPercent) / 100));
  })();

  const summary = [
      { icon: Scissors, label: "Serviço", value: service ? `${service.name} · ${formatDuration(service.durationMinutes)}` : undefined },
      {
        icon: User,
        label: "Profissional",
        value: professionalId === ANY ? "Qualquer profissional" : professional?.name,
      },
      {
        icon: CalendarClock,
        label: "Data e hora",
        value: slot ? `${formatDateLong(slot.start, tz)} às ${formatTime(slot.start, tz)}` : undefined,
      },
  ];

  if (services.isError || business.isError) {
    const err = services.error ?? business.error;
    return <ErrorState message={err?.message} onRetry={() => { void services.refetch(); void business.refetch(); }} />;
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <Stepper steps={STEPS} current={step} onStepClick={(i) => go(i)} />

        <div className="relative mt-8">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.section
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              aria-labelledby={`step-title-${step}`}
            >
              {step === 0 && (
                <StepShell id={0} title="Qual serviço você quer?" subtitle="Preços e duração já inclusos.">
                  {services.isLoading ? (
                    <ListSkeleton />
                  ) : (
                    <div role="radiogroup" aria-label="Serviços" className="grid gap-3 sm:grid-cols-2">
                      {services.data?.map((s) => (
                        <OptionCard
                          key={s.id}
                          selected={s.id === serviceId}
                          onSelect={() => {
                            if (s.id !== serviceId) {
                              setProfessionalId(undefined);
                              setSlot(undefined);
                            }
                            setServiceId(s.id);
                            go(1);
                          }}
                          title={s.name}
                          description={s.description ?? undefined}
                          aside={<span className="font-display text-lg font-semibold text-gold">{formatPrice(s.priceCents)}</span>}
                          meta={
                            <span className="inline-flex items-center gap-1">
                              <Timer className="size-3.5" /> {formatDuration(s.durationMinutes)}
                            </span>
                          }
                        />
                      ))}
                    </div>
                  )}
                </StepShell>
              )}

              {step === 1 && (
                <StepShell id={1} title="Com quem?" subtitle="Escolha um profissional ou deixe a gente escolher.">
                  {professionals.isLoading ? (
                    <ListSkeleton />
                  ) : professionals.isError ? (
                    <ErrorState message={professionals.error.message} onRetry={() => void professionals.refetch()} />
                  ) : professionals.data?.length === 0 ? (
                    <EmptyState title="Nenhum profissional faz este serviço no momento." />
                  ) : (
                    <div role="radiogroup" aria-label="Profissionais" className="grid gap-3 sm:grid-cols-2">
                      <OptionCard
                        selected={professionalId === ANY}
                        onSelect={() => {
                          setProfessionalId(ANY);
                          setSlot(undefined);
                          go(2);
                        }}
                        title="Qualquer profissional"
                        description="Mostra todos os horários livres. Escolhemos quem estiver disponível."
                        leading={
                          <span className="grid size-12 place-items-center rounded-full bg-gold/15 text-gold">
                            <Shuffle className="size-5" />
                          </span>
                        }
                        highlight="Mais horários"
                      />
                      {professionals.data?.map((p) => (
                        <OptionCard
                          key={p.id}
                          selected={p.id === professionalId}
                          onSelect={() => {
                            setProfessionalId(p.id);
                            setSlot(undefined);
                            go(2);
                          }}
                          title={p.name}
                          description={p.bio ?? undefined}
                          leading={
                            <Avatar className="size-12">
                              <AvatarFallback className="bg-gradient-to-br from-gold/30 to-gold/5 font-display text-gold">
                                {initials(p.name)}
                              </AvatarFallback>
                            </Avatar>
                          }
                        />
                      ))}
                    </div>
                  )}
                </StepShell>
              )}

              {step === 2 && serviceId && professionalId && business.data && (
                <StepShell id={2} title="Quando fica bom?" subtitle={`Horários no fuso de ${business.data.city} (${tz.replace("_", " ")}).`}>
                  <DateSlotPicker
                    serviceId={serviceId}
                    professionalId={professionalId}
                    timezone={tz}
                    maxAdvanceDays={business.data.maxAdvanceDays}
                    date={date}
                    onDateChange={(d) => {
                      setDate(d);
                      setSlot(undefined);
                    }}
                    slot={slot}
                    onSlotChange={setSlot}
                    openWeekdays={new Set(business.data.openingHours.filter((d) => d.intervals.length > 0).map((d) => d.weekday))}
                    allowWaitlist
                  />
                  <StepNav onBack={() => go(1)}>
                    <Button size="lg" disabled={!slot} onClick={() => go(3)}>
                      Continuar <ArrowRight />
                    </Button>
                  </StepNav>
                </StepShell>
              )}

              {step === 3 && (
                <StepShell id={3} title="Seus dados" subtitle="Usamos só para confirmar e lembrar do horário.">
                  <form
                    noValidate
                    className="grid max-w-xl gap-5"
                    onSubmit={form.handleSubmit((values) => {
                      setCustomer(values);
                      go(4);
                    })}
                  >
                    <Field label="Nome" error={form.formState.errors.name?.message} htmlFor="name">
                      <Input id="name" autoComplete="name" placeholder="Como podemos te chamar?" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
                    </Field>
                    <Field label="WhatsApp" error={form.formState.errors.whatsapp?.message} htmlFor="whatsapp">
                      <Input
                        id="whatsapp"
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder="(19) 99999-0000"
                        aria-invalid={!!form.formState.errors.whatsapp}
                        {...form.register("whatsapp", { onChange: (e) => form.setValue("whatsapp", maskPhone(e.target.value)) })}
                      />
                    </Field>
                    <Field label="E-mail" optional error={form.formState.errors.email?.message} htmlFor="email">
                      <Input id="email" type="email" autoComplete="email" placeholder="voce@email.com" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
                    </Field>
                    <Field label="Observações" optional error={form.formState.errors.notes?.message} htmlFor="notes">
                      <Textarea id="notes" rows={3} placeholder="Algum pedido especial?" {...form.register("notes")} />
                    </Field>
                    <StepNav onBack={() => go(2)}>
                      <Button size="lg" type="submit">
                        Revisar <ArrowRight />
                      </Button>
                    </StepNav>
                  </form>
                </StepShell>
              )}

              {step === 4 && service && slot && customer && (
                <StepShell id={4} title="Tudo certo?" subtitle="Confira antes de confirmar.">
                  <div className="overflow-hidden rounded-2xl border bg-card">
                    <div className="flex items-center justify-between gap-4 border-b bg-gold/5 p-5">
                      <div>
                        <p className="text-sm text-muted-foreground">{service.name}</p>
                        <p className="font-display text-xl font-semibold first-letter:uppercase">
                          {formatDateLong(slot.start, tz)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatTime(slot.start, tz)} – {formatTime(slot.end, tz)} · {formatDuration(service.durationMinutes)}
                        </p>
                      </div>
                      <span className="font-display text-2xl font-semibold text-gold">{formatPrice(service.priceCents)}</span>
                    </div>
                    <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
                      <Info label="Profissional" value={professionalId === ANY ? "Qualquer profissional (definido ao confirmar)" : professional?.name} />
                      <Info label="Nome" value={customer.name} />
                      <Info label="WhatsApp" value={customer.whatsapp} />
                      <Info label="E-mail" value={customer.email || "—"} />
                      {customer.notes && <Info label="Observações" value={customer.notes} className="sm:col-span-2" />}
                    </dl>
                  </div>
                  {business.data && (
                    <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" />
                      Você poderá remarcar ou cancelar pelo link do agendamento até {business.data.cancellationPolicyHours}h antes.
                      {pixAmount > 0
                        ? ` Para confirmar, pague ${pixAmount < service.priceCents ? `o sinal de ${formatPrice(pixAmount)} (${business.data.depositPercent}%)` : formatPrice(pixAmount)} via Pix em até ${business.data.paymentExpiryMinutes} min${pixAmount < service.priceCents ? "; o restante é pago no local" : ""}.`
                        : " Pagamento no local."}
                    </p>
                  )}
                  <StepNav onBack={() => go(3)}>
                    <Button size="lg" onClick={() => book.mutate()} disabled={book.isPending} className="min-w-52">
                      {book.isPending ? <LoaderCircle className="animate-spin" /> : <Check />}
                      {book.isPending ? "Confirmando..." : pixAmount > 0 ? "Confirmar e pagar com Pix" : "Confirmar agendamento"}
                    </Button>
                  </StepNav>
                </StepShell>
              )}
            </motion.section>
          </AnimatePresence>
          {step === 1 && (
            <StepNav onBack={() => go(0)} />
          )}
        </div>
      </div>

      {/* Resumo lateral */}
      <aside className="hidden lg:block" aria-label="Resumo do agendamento">
        <div className="sticky top-24 space-y-4 rounded-2xl border bg-card p-5">
          <p className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Seu agendamento</p>
          <ul className="space-y-4">
            {summary.map((item) => (
              <li key={item.label} className="flex gap-3">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", item.value ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground")}>
                  <item.icon className="size-4" />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="text-muted-foreground">{item.label}</p>
                  <p className={cn("font-medium first-letter:uppercase", !item.value && "text-muted-foreground/60")}>{item.value ?? "A escolher"}</p>
                </div>
              </li>
            ))}
          </ul>
          {service && (
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-xl font-semibold">{formatPrice(service.priceCents)}</span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function StepShell({ id, title, subtitle, children }: { id: number; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6">
        <h2 id={`step-title-${id}`} className="font-display text-2xl font-semibold tracking-tight sm:text-3xl" tabIndex={-1}>
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function StepNav({ onBack, children }: { onBack?: () => void; children?: React.ReactNode }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      {onBack ? (
        <Button variant="ghost" onClick={onBack} type="button">
          <ArrowLeft /> Voltar
        </Button>
      ) : (
        <span />
      )}
      {children}
    </div>
  );
}

function OptionCard({
  selected,
  onSelect,
  title,
  description,
  aside,
  meta,
  leading,
  highlight,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  aside?: React.ReactNode;
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  highlight?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full cursor-pointer items-start gap-4 rounded-2xl border bg-card p-4 text-left transition-all outline-none hover:border-gold/50 hover:bg-gold/[0.03] focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-5",
        selected && "border-primary bg-gold/[0.06] ring-1 ring-primary",
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold">{title}</p>
          {aside}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {(meta || highlight) && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            {meta}
            {highlight && <span className="rounded-full bg-gold/15 px-2 py-0.5 font-medium text-gold">{highlight}</span>}
          </div>
        )}
      </div>
      <span
        aria-hidden
        className={cn(
          "absolute top-4 right-4 grid size-5 place-items-center rounded-full border transition-all",
          selected ? "scale-100 border-primary bg-primary text-primary-foreground opacity-100" : "scale-75 opacity-0",
          aside && "hidden",
        )}
      >
        <Check className="size-3" />
      </span>
    </button>
  );
}

function Field({
  label,
  htmlFor,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Info({ label, value, className }: { label: string; value?: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium break-words">{value}</dd>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}
