"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { bookingLink } from "@/lib/tenant";

const subscribe = () => () => undefined;

/** Link público de agendamento do negócio (subdomínio ou /n/slug). */
export function BookingLinkCard({ slug }: { slug: string }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const link = origin ? bookingLink(slug, origin) : "";

  return (
    <Card className="gap-3 border-gold/30 bg-gradient-to-br from-gold/10 to-card py-4">
      <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
            <Link2 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Seu link de agendamento</p>
            <p className="truncate font-mono text-xs text-muted-foreground" data-testid="booking-link">
              {link || "…"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!link}
            onClick={() =>
              void navigator.clipboard?.writeText(link).then(
                () => toast.success("Link copiado!"),
                () => toast.error("Não foi possível copiar."),
              )
            }
          >
            <Copy /> Copiar
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={link || "#"} target="_blank" rel="noreferrer">
              <ExternalLink /> Abrir
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
