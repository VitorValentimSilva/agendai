"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, LoaderCircle, LogIn, Scissors, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, unwrap } from "@/lib/api/client";

const schema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha tem pelo menos 6 caracteres."),
});
type Values = z.infer<typeof schema>;

const DEMO_USERS = [
  { label: "Dono (acesso completo)", email: "demo@agendai.app", icon: KeyRound },
  { label: "Barbeiro (só a própria agenda)", email: "barbeiro@agendai.app", icon: Scissors },
];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  const submit = form.handleSubmit(async (values) => {
    setError(undefined);
    try {
      const me = await unwrap(api.POST("/auth/login", { body: values }));
      queryClient.clear();
      queryClient.setQueryData(["me"], me);
      const next = params.get("next");
      router.replace(next && next.startsWith("/admin") ? next : "/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
    }
  });

  return (
    <div className="space-y-6">
      <form onSubmit={submit} noValidate className="space-y-4" aria-describedby={error ? "login-error" : undefined}>
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="username" placeholder="voce@negocio.com" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
          {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...form.register("password")} aria-invalid={!!form.formState.errors.password} />
          {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
        </div>
        {error && (
          <p id="login-error" role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <LoaderCircle className="animate-spin" /> : <LogIn />}
          Entrar no painel
        </Button>
      </form>

      <section aria-labelledby="demo-title" className="rounded-2xl border border-dashed border-gold/40 bg-gold/5 p-4">
        <h2 id="demo-title" className="flex items-center gap-2 text-sm font-semibold">
          <UserRound className="size-4 text-gold" /> Acesso de demonstração
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Senha para os dois: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">demo1234</code>. Os dados são
          fictícios e voltam ao estado inicial todo dia.
        </p>
        <ul className="mt-3 grid gap-2">
          {DEMO_USERS.map((u) => (
            <li key={u.email}>
              <button
                type="button"
                onClick={() => {
                  form.setValue("email", u.email, { shouldValidate: true });
                  form.setValue("password", "demo1234", { shouldValidate: true });
                  void submit();
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition-colors outline-none hover:border-gold/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-gold/15 text-gold">
                  <u.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{u.label}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{u.email}</span>
                </span>
                <span className="text-xs font-medium text-gold">Entrar →</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
