import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-medium text-foreground">Barbearia Navalha de Ouro</span> é um negócio{" "}
          <strong className="font-medium text-foreground">fictício</strong>, criado para demonstrar o Agendaí.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="underline-offset-4 hover:text-foreground hover:underline">
            Painel do negócio
          </Link>
          <span>
            Feito com <span className="font-semibold text-gold">Agendaí</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
