"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useBusiness } from "@/hooks/use-public";

export const DEMO_SLUG = "navalha-de-ouro";

export function SiteFooter() {
  const business = useBusiness();
  const b = business.data;

  // Título da aba com o nome do negócio (o site é white-label)
  useEffect(() => {
    if (b && !document.title.includes(b.name)) document.title = `${document.title.split(" · ")[0]} · ${b.name}`;
  }, [b]);

  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          {b?.slug === DEMO_SLUG ? (
            <>
              <span className="font-medium text-foreground">{b.name}</span> é um negócio{" "}
              <strong className="font-medium text-foreground">fictício</strong>, criado para demonstrar o Agendaí.
            </>
          ) : b ? (
            <>
              <span className="font-medium text-foreground">{b.name}</span> · {b.city} – {b.state}
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/admin" className="underline-offset-4 hover:text-foreground hover:underline">
            Painel do negócio
          </Link>
          <Link href="/cadastro" className="underline-offset-4 hover:text-foreground hover:underline">
            Crie sua agenda grátis
          </Link>
          <span>
            Feito com <span className="font-semibold text-gold">Agendaí</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
