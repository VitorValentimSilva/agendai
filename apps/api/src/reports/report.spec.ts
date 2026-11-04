import { buildReport, commissionOf, csvCell, toCsv, type ReportRow } from './report.js';

const row = (p: string, status: ReportRow['status'], price: number, service = 's1'): ReportRow => ({
  status,
  priceCents: price,
  professionalId: p,
  professionalName: p === 'a' ? 'Ana' : 'Bruno',
  commissionPercent: p === 'a' ? 40 : 50,
  serviceId: service,
  serviceName: service === 's1' ? 'Corte' : 'Barba',
});

describe('buildReport', () => {
  const report = buildReport([
    row('a', 'COMPLETED', 5000),
    row('a', 'COMPLETED', 4000, 's2'),
    row('a', 'NO_SHOW', 5000),
    row('a', 'CANCELED', 5000),
    row('b', 'COMPLETED', 3333),
    row('b', 'SCHEDULED', 5000),
  ]);

  it('calcula receita, comissão e ticket médio por profissional', () => {
    const ana = report.professionals.find((p) => p.professionalId === 'a')!;
    expect(ana).toMatchObject({ appointments: 3, completed: 2, noShows: 1, canceled: 1, revenueCents: 9000, commissionCents: 3600, averageTicketCents: 4500 });
    const bruno = report.professionals.find((p) => p.professionalId === 'b')!;
    expect(bruno).toMatchObject({ completed: 1, revenueCents: 3333, commissionCents: 1667 });
    expect(report.professionals[0]!.professionalId).toBe('a'); // ordenado por receita
  });

  it('totaliza e calcula receita líquida', () => {
    expect(report.totals).toEqual({ appointments: 5, completed: 3, noShows: 1, canceled: 1, revenueCents: 12333, commissionCents: 5267, netRevenueCents: 7066 });
  });

  it('agrupa serviços concluídos', () => {
    expect(report.services).toEqual([
      { serviceId: 's1', serviceName: 'Corte', completed: 2, revenueCents: 8333 },
      { serviceId: 's2', serviceName: 'Barba', completed: 1, revenueCents: 4000 },
    ]);
  });

  it('comissão arredonda ao centavo', () => {
    expect(commissionOf(3333, 50)).toBe(1667);
    expect(commissionOf(0, 40)).toBe(0);
  });
});

describe('CSV', () => {
  it('escapa aspas/; e neutraliza fórmulas', () => {
    expect(csvCell('João; "Zé"')).toBe('"João; ""Zé"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-10')).toBe("'-10");
    expect(csvCell(-10)).toBe('-10');
    expect(csvCell(null)).toBe('');
  });

  it('gera CSV com BOM, ; e CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('﻿a;b\r\n1;x\r\n');
  });
});
