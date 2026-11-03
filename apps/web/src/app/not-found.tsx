import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-display text-7xl font-semibold text-gold">404</p>
        <h1 className="mt-3 text-xl font-semibold">Página não encontrada</h1>
        <p className="mt-1 text-muted-foreground">O endereço pode ter mudado ou não existe mais.</p>
        <Button asChild className="mt-6">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  );
}
