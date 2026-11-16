"use client";

import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusiness } from "@/hooks/use-public";
import { BrandMark } from "./brand";

const SEGMENT_LABEL: Record<string, string> = { barbearia: "Barbearia", salao: "Salão de beleza", clinica: "Clínica", estudio: "Estúdio" };

/** Negócio exibido no cabeçalho. Sem `business`, usa o do domínio/link atual. */
export interface HeaderBusiness {
  name: string;
  slug: string;
  segment: string;
}

export function SiteHeader({ showCta = true, business: fixed }: { showCta?: boolean; business?: HeaderBusiness | null }) {
  const current = useBusiness();
  // Página do agendamento: mostra o negócio dono do agendamento, mesmo aberta em outro domínio/link
  // null = ainda carregando o negócio fixo (não mostra o do domínio nesse meio-tempo)
  const data = fixed === undefined ? current.data : (fixed ?? undefined);
  const name = data?.name;
  const base = fixed ? `/n/${fixed.slug}` : "";
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={base || "/"} className="flex items-center gap-2.5 rounded-lg" aria-label={name ? `Página inicial — ${name}` : "Página inicial"}>
          <BrandMark />
          <span className="leading-tight">
            {name ? (
              <span className="block max-w-[46vw] truncate font-display text-[15px] font-semibold tracking-tight sm:max-w-xs">{name}</span>
            ) : (
              <Skeleton className="h-4 w-32" />
            )}
            <span className="block text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              {data ? (SEGMENT_LABEL[data.segment] ?? "Agendamento") : "\u00a0"}
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Principal">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href={`${base}/#servicos`}>Serviços</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href={`${base}/#equipe`}>Equipe</Link>
          </Button>
          {showCta && (
            <Button asChild size="sm">
              <Link href={`${base}/agendar`}>
                <CalendarCheck />
                Agendar
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
