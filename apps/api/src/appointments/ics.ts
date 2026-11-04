/** Gera um arquivo iCalendar (RFC 5545) para um agendamento. */
export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  location: string;
  url?: string;
  /** CONFIRMED ou TENTATIVE */
  status?: 'CONFIRMED' | 'TENTATIVE';
  now?: Date;
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Quebra linhas longas (máx. 75 octetos) conforme a RFC. */
function fold(line: string): string {
  const out: string[] = [];
  let current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, 'utf8') > 73) {
      out.push(current);
      current = ' ' + ch;
    } else current += ch;
  }
  out.push(current);
  return out.join('\r\n');
}

function eventLines(e: IcsEvent, withAlarm: boolean): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(e.now ?? new Date())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${escape(e.summary)}`,
    `DESCRIPTION:${escape(e.description)}`,
    `LOCATION:${escape(e.location)}`,
    ...(e.status ? [`STATUS:${e.status}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    ...(withAlarm
      ? ['BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${escape(e.summary)}`, 'END:VALARM']
      : []),
    'END:VEVENT',
  ];
}

/** Um agendamento (arquivo .ics para o cliente baixar). */
export function buildIcs(e: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agendai//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...eventLines(e, true),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Agenda inteira (feed assinável no Google Agenda/Apple/Outlook). */
export function buildIcsCalendar(name: string, events: IcsEvent[], timezone: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agendai//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(name)}`,
    `X-WR-TIMEZONE:${timezone}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...events.flatMap((e) => eventLines(e, false)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
