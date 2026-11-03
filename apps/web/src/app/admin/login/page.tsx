import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/site/brand";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="bg-grain grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark className="size-12" />
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Painel do negócio</h1>
          <p className="mt-1 text-sm text-muted-foreground">Barbearia Navalha de Ouro · Agendaí</p>
        </div>
        <div className="rounded-2xl border bg-card/90 p-6 shadow-xl backdrop-blur sm:p-8">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">
            ← Voltar ao site de agendamento
          </Link>
        </p>
      </div>
    </main>
  );
}
