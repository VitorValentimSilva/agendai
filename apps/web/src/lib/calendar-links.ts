function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Link "Adicionar ao Google Agenda" (template de evento). */
export function googleCalendarUrl(params: {
  title: string;
  start: string;
  end: string;
  details?: string;
  location?: string;
}): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: params.title,
    dates: `${stamp(params.start)}/${stamp(params.end)}`,
    ...(params.details ? { details: params.details } : {}),
    ...(params.location ? { location: params.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
