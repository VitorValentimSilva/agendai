import { buildIcs, buildIcsCalendar } from './ics.js';

describe('buildIcs', () => {
  const ics = buildIcs({
    uid: 'abc@agendai.app',
    start: new Date('2026-11-04T12:00:00.000Z'),
    end: new Date('2026-11-04T12:45:00.000Z'),
    summary: 'Corte — Barbearia Navalha de Ouro',
    description: 'Linha 1\nCódigo: K7Q-4MZ; com vírgula, e ponto e vírgula',
    location: 'Rua Fictícia, 123',
    now: new Date('2026-11-03T10:00:00.000Z'),
  });

  it('gera um VEVENT com datas em UTC', () => {
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261104T120000Z');
    expect(ics).toContain('DTEND:20261104T124500Z');
    expect(ics).toContain('DTSTAMP:20261103T100000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapa vírgulas, ponto e vírgula e quebras de linha', () => {
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('DESCRIPTION:Linha 1\\nCódigo: K7Q-4MZ' + String.fromCharCode(92) + '; com vírgula\\, e ponto e vírgula');
    expect(unfolded).toContain('LOCATION:Rua Fictícia\\, 123');
  });

  it('dobra linhas com mais de 75 octetos', () => {
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
  });
});

describe('buildIcsCalendar', () => {
  it('gera vários eventos com nome da agenda e status', () => {
    const ev = (uid: string, status: 'CONFIRMED' | 'TENTATIVE') => ({
      uid,
      start: new Date('2026-11-04T12:00:00Z'),
      end: new Date('2026-11-04T13:00:00Z'),
      summary: 'Corte — João',
      description: 'x',
      location: 'y',
      status,
      now: new Date('2026-11-03T00:00:00Z'),
    });
    const cal = buildIcsCalendar('Agenda do Rafael', [ev('a', 'CONFIRMED'), ev('b', 'TENTATIVE')], 'America/Sao_Paulo');
    expect(cal.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(cal).toContain('X-WR-CALNAME:Agenda do Rafael');
    expect(cal).toContain('STATUS:TENTATIVE');
    expect(cal).not.toContain('VALARM');
  });
});
