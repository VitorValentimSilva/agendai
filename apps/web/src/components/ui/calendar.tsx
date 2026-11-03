"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn("group/calendar bg-transparent p-3 [--cell-size:--spacing(10)]", className)}
      classNames={{
        root: cn("w-fit", defaults.root),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaults.months),
        month: cn("flex w-full flex-col gap-4", defaults.month),
        nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", defaults.nav),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-40",
          defaults.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-40",
          defaults.button_next,
        ),
        month_caption: cn("flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)", defaults.month_caption),
        caption_label: cn("text-sm font-semibold capitalize select-none", defaults.caption_label),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn(
          "flex-1 rounded-md text-[0.75rem] font-medium text-muted-foreground uppercase select-none",
          defaults.weekday,
        ),
        week: cn("mt-1.5 flex w-full", defaults.week),
        day: cn("group/day relative aspect-square h-full w-full p-0.5 text-center select-none", defaults.day),
        today: cn("[&>button]:ring-1 [&>button]:ring-gold/50", defaults.today),
        outside: cn("text-muted-foreground/50 aria-selected:text-muted-foreground", defaults.outside),
        disabled: cn("text-muted-foreground opacity-35", defaults.disabled),
        hidden: cn("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...p }) => <div data-slot="calendar" ref={rootRef} className={cn(className)} {...p} />,
        Chevron: ({ className, orientation, ...p }) =>
          orientation === "left" ? (
            <ChevronLeftIcon className={cn("size-4", className)} {...p} />
          ) : (
            <ChevronRightIcon className={cn("size-4", className)} {...p} />
          ),
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString("pt-BR")}
      data-selected-single={modifiers.selected}
      className={cn(
        "flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 rounded-lg leading-none font-medium",
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[selected-single=true]:hover:bg-primary/90",
        "group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
