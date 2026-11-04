"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, LoaderCircle, Rocket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, unwrap } from "@/lib/api/client";
import { isValidPhone, maskPhone } from "@/lib/phone";
import { rootDomain } from "@/lib/tenant";
import { useDebounced } from "@/hooks/use-debounced";
import { cn } from "@/lib/utils";

const SEGMENTS = [
  { value: "barbearia", label: "Barbearia" },
  { value: "salao", label: "Salão de beleza" },
  { value: "clinica", label: "Clínica / consultório" },
  { value: "estudio", label: "Estúdio (tatuagem, pilates, fotografia...)" },
] as const;

const schema = z.object({
  businessName: z.string().trim().min(2, "Informe o nome do negócio.").max(80),
  slug: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "Use letras minúsculas, números e hífen (até 40)."),
  segment: z.enum(["barbearia", "salao", "clinica", "estudio"]),
  ownerName: z.string().trim().min(2, "Informe seu nome.").max(80),
  email: z.email("E-mail inválido."),
  password: z.string().min(8, "Mínimo de 8 caracteres.").max(72),
  whatsapp: z.string().refine(isValidPhone, "WhatsApp inválido."),
  addressLine: z.string().trim().min(3, "Informe o endereço."),
  city: z.string().trim().min(2, "Informe a cidade."),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/, "UF com 2 letras."),
});
type Values = z.infer<typeof schema>;

/** "Barbearia do Zé" → "barbearia-do-ze" */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function SignupForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [slugTouched, setSlugTouched] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: "",
      slug: "",
      segment: "barbearia",
      ownerName: "",
      email: "",
      password: "",
      whatsapp: "",
      addressLine: "",
      city: "",
      state: "",
    },
    mode: "onTouched",
  });
  const slug = useWatch({ control: form.control, name: "slug" });
  const segment = useWatch({ control: form.control, name: "segment" });
  const debouncedSlug = useDebounced(slug, 400);
  const availability = useQuery({
    queryKey: ["slug-available", debouncedSlug],
    enabled: debouncedSlug.length > 0,
    queryFn: () => unwrap(api.GET("/auth/slug-available", { params: { query: { slug: debouncedSlug } } })),
  });
  const e = form.formState.errors;
  const root = rootDomain();

  const submit = form.handleSubmit(async (values) => {
    try {
      const me = await unwrap(api.POST("/auth/signup", { body: { ...values, state: values.state.toUpperCase() } }));
      queryClient.clear();
      queryClient.setQueryData(["me"], me);
      toast.success("Sua agenda está no ar!", { description: "Revise serviços e horários no painel." });
      router.replace("/admin");
    } catch (error) {
      toast.error("Não foi possível criar a conta", { description: error instanceof Error ? error.message : undefined });
    }
  });

  const field = (name: keyof Values, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-2">
      <Label htmlFor={`s-${name}`}>{label}</Label>
      <Input id={`s-${name}`} aria-invalid={!!e[name]} {...form.register(name)} {...props} />
      {e[name] && <p className="text-sm text-destructive">{e[name]?.message}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-semibold tracking-wide text-gold uppercase">Seu negócio</legend>
        <div className="grid gap-2">
          <Label htmlFor="s-businessName">Nome do negócio</Label>
          <Input
            id="s-businessName"
            placeholder="Barbearia do Zé"
            aria-invalid={!!e.businessName}
            {...form.register("businessName", {
              onChange: (ev) => {
                if (!slugTouched) form.setValue("slug", slugify(ev.target.value), { shouldValidate: true });
              },
            })}
          />
          {e.businessName && <p className="text-sm text-destructive">{e.businessName.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="s-slug">Endereço do seu link</Label>
          <div className="flex items-center overflow-hidden rounded-lg border border-input focus-within:ring-[3px] focus-within:ring-ring/40 dark:bg-input/20">
            {!root && <span className="pl-3 text-sm text-muted-foreground">…/n/</span>}
            <input
              id="s-slug"
              className="h-10 min-w-0 flex-1 bg-transparent px-2 text-base outline-none md:text-sm"
              aria-invalid={!!e.slug || availability.data?.available === false}
              aria-describedby="slug-status"
              {...form.register("slug", { onChange: () => setSlugTouched(true) })}
            />
            {root && <span className="pr-3 text-sm text-muted-foreground">.{root}</span>}
          </div>
          <p id="slug-status" className="flex items-center gap-1.5 text-sm" aria-live="polite">
            {e.slug ? (
              <span className="text-destructive">{e.slug.message}</span>
            ) : availability.isFetching ? (
              <span className="text-muted-foreground">Verificando…</span>
            ) : availability.data ? (
              availability.data.available ? (
                <span className="flex items-center gap-1 text-success">
                  <Check className="size-4" /> Disponível
                </span>
              ) : (
                <span className="flex items-center gap-1 text-destructive">
                  <X className="size-4" /> {availability.data.reason}
                </span>
              )
            ) : null}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="s-segment">Segmento</Label>
          <Select value={segment} onValueChange={(v) => form.setValue("segment", v as Values["segment"])}>
            <SelectTrigger id="s-segment" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Criamos serviços e horários de exemplo — você ajusta depois.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="s-whatsapp">WhatsApp do negócio</Label>
            <Input
              id="s-whatsapp"
              inputMode="tel"
              placeholder="(19) 99999-0000"
              aria-invalid={!!e.whatsapp}
              {...form.register("whatsapp", { onChange: (ev) => form.setValue("whatsapp", maskPhone(ev.target.value)) })}
            />
            {e.whatsapp && <p className="text-sm text-destructive">{e.whatsapp.message}</p>}
          </div>
          {field("addressLine", "Endereço", { placeholder: "Rua, número — bairro" })}
        </div>
        <div className="grid grid-cols-[1fr_5.5rem] gap-4">
          {field("city", "Cidade")}
          {field("state", "UF", { maxLength: 2, className: "uppercase" })}
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-semibold tracking-wide text-gold uppercase">Seu acesso</legend>
        {field("ownerName", "Seu nome", { autoComplete: "name" })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("email", "E-mail", { type: "email", autoComplete: "email" })}
          {field("password", "Senha", { type: "password", autoComplete: "new-password", placeholder: "Mínimo 8 caracteres" })}
        </div>
      </fieldset>

      <Button
        type="submit"
        size="lg"
        disabled={form.formState.isSubmitting || availability.data?.available === false}
        className={cn("w-full")}
      >
        {form.formState.isSubmitting ? <LoaderCircle className="animate-spin" /> : <Rocket />}
        Criar minha agenda
      </Button>
    </form>
  );
}
