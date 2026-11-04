"use client";

import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusiness } from "@/hooks/use-public";
import { BrandMark } from "./brand";

const SEGMENT_LABEL: Record<string, string> = { barbearia: "Barbearia", salao: "Salão de beleza", clinica: "Clínica", estudio: "Estúdio" };

export function SiteHeader({ showCta = true }: { showCta?: boolean }) {
  const business = useBusiness();
  const name = business.data?.name;
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label={name ? `Página inicial — ${name}` : "Página inicial"}>
          <BrandMark />
          <span className="leading-tight">
            {name ? (
              <span className="block max-w-[46vw] truncate font-display text-[15px] font-semibold tracking-tight sm:max-w-xs">{name}</span>
            ) : (
              <Skeleton className="h-4 w-32" />
            )}
            <span className="block text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              {business.data ? (SEGMENT_LABEL[business.data.segment] ?? "Agendamento") : "\u00a0"}
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Principal">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/#servicos">Serviços</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/#equipe">Equipe</Link>
          </Button>
          {showCta && (
            <Button asChild size="sm">
              <Link href="/agendar">
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
