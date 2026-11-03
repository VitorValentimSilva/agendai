import type { Schemas } from "@/lib/api/client";

type Status = Schemas["AdminAppointmentDto"]["status"];

export const STATUS_LABEL: Record<Status, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

export const STATUS_VARIANT: Record<Status, "info" | "success" | "secondary" | "destructive" | "warning"> = {
  SCHEDULED: "info",
  CONFIRMED: "success",
  COMPLETED: "secondary",
  CANCELED: "destructive",
  NO_SHOW: "warning",
};

/** Classes dos blocos na agenda */
export const STATUS_BLOCK: Record<Status, string> = {
  SCHEDULED: "border-info/50 bg-info/15 hover:bg-info/25",
  CONFIRMED: "border-gold/60 bg-gold/20 hover:bg-gold/30",
  COMPLETED: "border-success/40 bg-success/12 hover:bg-success/20",
  CANCELED: "border-destructive/30 bg-destructive/8 opacity-60 line-through decoration-destructive/50 hover:opacity-80",
  NO_SHOW: "border-warning/50 bg-warning/12 hover:bg-warning/20",
};
