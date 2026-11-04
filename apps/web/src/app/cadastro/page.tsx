import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Link2, Smartphone } from "lucide-react";
import { BrandMark } from "@/components/site/brand";
import { SignupForm } from "@/components/site/signup-form";

export const metadata: Metadata = {
  title: "Crie sua agenda online grátis · Agendaí",
  description: "Agenda online para barbearias, salões, clínicas e estúdios. Link de agendamento próprio em 2 minutos.",
};

const PERKS = [
  { icon: Link2, text: "Link próprio para seus clientes agendarem 24h" },
  { icon: Smartphone, text: "Lembrete por WhatsApp e Pix na confirmação" },
  { icon: CalendarCheck, text: "Painel com agenda, clientes e relatórios" },
];

export default function CadastroPage() {
  return (
    <main className="bg-grain min-h-dvh px-4 py-10 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div className="lg:sticky lg:top-16">
          <BrandMark className="size-12" />
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Sua agenda online <span className="text-gold italic">em 2 minutos</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Para barbearias, salões, clínicas e estúdios. Grátis para começar.
          </p>
          <ul className="mt-8 space-y-3">
            {PERKS.map((p) => (
              <li key={p.text} className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-gold/15 text-gold">
                  <p.icon className="size-4" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/admin/login" className="font-medium text-gold underline-offset-4 hover:underline">
              Entrar no painel
            </Link>
          </p>
        </div>
        <div className="rounded-2xl border bg-card/90 p-6 shadow-xl backdrop-blur sm:p-8">
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
