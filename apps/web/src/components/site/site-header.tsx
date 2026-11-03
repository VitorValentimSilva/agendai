import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./brand";

export function SiteHeader({ showCta = true }: { showCta?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Página inicial da Navalha de Ouro">
          <BrandMark />
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-semibold tracking-tight">Navalha de Ouro</span>
            <span className="block text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Barbearia</span>
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
