import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

/** Monograma da marca da demo (troque pelo logo do cliente). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 place-items-center rounded-xl border border-gold/40 bg-gradient-to-br from-gold/25 to-gold/5 text-gold shadow-inner",
        className,
      )}
    >
      <Scissors className="size-4.5 -rotate-45" />
    </span>
  );
}
