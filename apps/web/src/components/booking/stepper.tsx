"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function Stepper({ steps, current, onStepClick }: { steps: string[]; current: number; onStepClick?: (i: number) => void }) {
  return (
    <nav aria-label="Etapas do agendamento" className="w-full">
      {/* Mobile: barra de progresso compacta */}
      <div className="sm:hidden">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">{steps[current]}</span>
          <span className="text-muted-foreground">
            Etapa {current + 1} de {steps.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={current + 1}>
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${((current + 1) / steps.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
          />
        </div>
      </div>

      {/* Desktop */}
      <ol className="hidden items-center sm:flex">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
              <button
                type="button"
                disabled={!done || !onStepClick}
                onClick={() => onStepClick?.(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex items-center gap-2 rounded-lg py-1 pr-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  done && onStepClick && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "relative grid size-8 place-items-center rounded-full border text-xs font-semibold transition-colors",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary text-primary",
                    !done && !active && "text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                  {active && (
                    <motion.span
                      layoutId="step-ring"
                      className="absolute -inset-1 rounded-full ring-2 ring-primary/30"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </span>
                <span className={cn("whitespace-nowrap", active ? "font-medium text-foreground" : "text-muted-foreground", done && onStepClick && "group-hover:text-foreground")}>
                  {label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span aria-hidden className="mx-2 h-px flex-1 bg-border">
                  <motion.span
                    className="block h-px bg-primary"
                    initial={false}
                    animate={{ width: done ? "100%" : "0%" }}
                    transition={{ duration: 0.35 }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
