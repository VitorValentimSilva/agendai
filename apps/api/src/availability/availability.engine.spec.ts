import {
  computeAnySlots,
  computeProfessionalSlots,
  localMinuteToInstant,
  parseLocalDate,
  pickLeastBusyProfessional,
  toLocalDate,
  type ProfessionalSchedule,
  type SlotRules,
} from './availability.engine.js';

const SP = 'America/Sao_Paulo';
const rules: SlotRules = { timezone: SP, slotIntervalMinutes: 30, minAdvanceMinutes: 0, maxAdvanceDays: 30 };
// 2026-11-03 é uma terça-feira (weekday 2). "Agora" = segunda 02/11 08:00 em São Paulo (11:00 UTC).
const NOW = new Date('2026-11-02T11:00:00.000Z');
const TUESDAY = parseLocalDate('2026-11-03');

const hhmm = (d: Date, tz = SP) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

function schedule(partial: Partial<ProfessionalSchedule> = {}): ProfessionalSchedule {
  return {
    professionalId: 'p1',
    workingHours: [{ weekday: 2, startMinute: 9 * 60, endMinute: 12 * 60 }],
    busy: [],
    ...partial,
  };
}

describe('computeProfessionalSlots', () => {
  it('gera horários dentro do expediente respeitando duração e intervalo', () => {
    const slots = computeProfessionalSlots({ date: TUESDAY, rules, durationMinutes: 60, schedule: schedule(), now: NOW });
    expect(slots.map((s) => hhmm(s.start))).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00']);
    expect(slots[0]!.start.toISOString()).toBe('2026-11-03T12:00:00.000Z');
    expect(slots[0]!.end.toISOString()).toBe('2026-11-03T13:00:00.000Z');
  });

  it('suporta expediente partido (manhã e tarde) sem horários no almoço', () => {
    const s = schedule({
      workingHours: [
        { weekday: 2, startMinute: 14 * 60, endMinute: 16 * 60 },
        { weekday: 2, startMinute: 9 * 60, endMinute: 11 * 60 },
      ],
    });
    const slots = computeProfessionalSlots({ date: TUESDAY, rules, durationMinutes: 60, schedule: s, now: NOW });
    expect(slots.map((x) => hhmm(x.start))).toEqual(['09:00', '09:30', '10:00', '14:00', '14:30', '15:00']);
  });

  it('não oferece serviço que não cabe no fim do expediente', () => {
    const slots = computeProfessionalSlots({ date: TUESDAY, rules, durationMinutes: 75, schedule: schedule(), now: NOW });
    // 75 min: último início possível 10:45 -> com intervalo de 30, 10:30 é o último.
    expect(slots.map((x) => hhmm(x.start)).at(-1)).toBe('10:30');
    for (const slot of slots) {
      expect(slot.end.getTime()).toBeLessThanOrEqual(localMinuteToInstant(TUESDAY, 12 * 60, SP).getTime());
    }
  });

  it('retorna vazio quando o serviço é maior que o expediente inteiro', () => {
    const slots = computeProfessionalSlots({ date: TUESDAY, rules, durationMinutes: 240, schedule: schedule(), now: NOW });
    expect(slots).toEqual([]);
  });

  it('remove horários que colidem com bloqueios e agendamentos', () => {
    const s = schedule({
      busy: [
        // agendamento 09:30-10:00
        { start: localMinuteToInstant(TUESDAY, 9 * 60 + 30, SP), end: localMinuteToInstant(TUESDAY, 10 * 60, SP) },
        // bloqueio 11:00-12:00
        { start: localMinuteToInstant(TUESDAY, 11 * 60, SP), end: localMinuteToInstant(TUESDAY, 12 * 60, SP) },
      ],
    });
    const slots = computeProfessionalSlots({ date: TUESDAY, rules, durationMinutes: 30, schedule: s, now: NOW });
    expect(slots.map((x) => hhmm(x.start))).toEqual(['09:00', '10:00', '10:30']);
  });

  it('permite encostar no fim de um agendamento (intervalo semiaberto)', () => {
    const s = schedule({
      busy: [{ start: localMinuteToInstant(TUESDAY, 9 * 60, SP), end: localMinuteToInstant(TUESDAY, 10 * 60, SP) }],
    });
    const slots = computeProfessionalSlots({ date: TUESDAY, rules, durationMinutes: 60, schedule: s, now: NOW });
    expect(slots.map((x) => hhmm(x.start))[0]).toBe('10:00');
  });

  it('aplica a antecedência mínima e esconde horários passados', () => {
    // Agora: terça 09:40 em SP. Antecedência 60 min -> primeiro horário 10:40 => 11:00
    const now = localMinuteToInstant(TUESDAY, 9 * 60 + 40, SP);
    const withAdvance = computeProfessionalSlots({
      date: TUESDAY,
      rules: { ...rules, minAdvanceMinutes: 60 },
      durationMinutes: 30,
      schedule: schedule(),
      now,
    });
    expect(withAdvance.map((x) => hhmm(x.start))).toEqual(['11:00', '11:30']);

    const withoutAdvance = computeProfessionalSlots({ date: TUESDAY, rules, durationMinutes: 30, schedule: schedule(), now });
    expect(withoutAdvance.map((x) => hhmm(x.start))[0]).toBe('10:00');
  });

  it('não permite datas passadas nem além do limite de dias à frente', () => {
    const args = { rules: { ...rules, maxAdvanceDays: 7 }, durationMinutes: 30, schedule: schedule(), now: NOW };
    expect(computeProfessionalSlots({ ...args, date: parseLocalDate('2026-10-27') })).toEqual([]); // terça passada
    expect(computeProfessionalSlots({ ...args, date: parseLocalDate('2026-11-03') })).not.toEqual([]); // amanhã
  });

  it('respeita exatamente o limite de dias à frente', () => {
    const args = { durationMinutes: 30, schedule: schedule(), now: NOW };
    // 02/11 -> 10/11 = 8 dias
    expect(computeProfessionalSlots({ ...args, rules: { ...rules, maxAdvanceDays: 7 }, date: parseLocalDate('2026-11-10') })).toEqual([]);
    expect(
      computeProfessionalSlots({ ...args, rules: { ...rules, maxAdvanceDays: 8 }, date: parseLocalDate('2026-11-10') }),
    ).not.toEqual([]);
  });

  it('não gera horários em dias sem expediente', () => {
    const wednesday = parseLocalDate('2026-11-04');
    expect(computeProfessionalSlots({ date: wednesday, rules, durationMinutes: 30, schedule: schedule(), now: NOW })).toEqual([]);
  });

  it('converte corretamente o fuso horário do negócio para UTC', () => {
    const tokyo = computeProfessionalSlots({
      date: TUESDAY,
      rules: { ...rules, timezone: 'Asia/Tokyo' },
      durationMinutes: 60,
      schedule: schedule(),
      now: new Date('2026-11-01T00:00:00Z'),
    });
    // 09:00 em Tóquio (UTC+9) = 00:00 UTC do mesmo dia
    expect(tokyo[0]!.start.toISOString()).toBe('2026-11-03T00:00:00.000Z');
  });

  it('lida com virada de dia: horário noturno local cai no dia seguinte em UTC', () => {
    const night = schedule({ workingHours: [{ weekday: 2, startMinute: 20 * 60, endMinute: 24 * 60 }] });
    const slots = computeProfessionalSlots({ date: TUESDAY, rules, durationMinutes: 60, schedule: night, now: NOW });
    expect(slots.map((x) => hhmm(x.start))).toEqual(['20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00']);
    // 21:00 em SP (UTC-3) = 00:00 UTC de quarta
    expect(slots[2]!.start.toISOString()).toBe('2026-11-04T00:00:00.000Z');
    // E todos continuam pertencendo à terça local
    for (const slot of slots) expect(toLocalDate(slot.start, SP)).toEqual(TUESDAY);
    // O último termina exatamente à meia-noite local
    expect(slots.at(-1)!.end.toISOString()).toBe('2026-11-04T03:00:00.000Z');
  });

  it('o "hoje" é calculado no fuso do negócio, não em UTC', () => {
    // 23:30 de segunda em SP = 02:30 UTC de terça. Terça ainda é "amanhã" localmente -> permitido.
    const now = new Date('2026-11-03T02:30:00Z');
    const slots = computeProfessionalSlots({
      date: TUESDAY,
      rules: { ...rules, maxAdvanceDays: 1 },
      durationMinutes: 30,
      schedule: schedule(),
      now,
    });
    expect(slots.length).toBeGreaterThan(0);
    // Segunda (hoje local) continua válida, mesmo já sendo terça em UTC
    const monday = parseLocalDate('2026-11-02');
    const mondaySchedule = schedule({ workingHours: [{ weekday: 1, startMinute: 23 * 60 + 30, endMinute: 24 * 60 }] });
    const r = computeProfessionalSlots({
      date: monday,
      rules,
      durationMinutes: 30,
      schedule: mondaySchedule,
      now: new Date('2026-11-03T02:00:00Z'), // 23:00 de segunda em SP
    });
    expect(r.map((x) => hhmm(x.start))).toEqual(['23:30']);
  });
});

describe('computeAnySlots ("qualquer profissional")', () => {
  it('une os horários de todos e informa quem está livre', () => {
    const a = schedule({ professionalId: 'a', workingHours: [{ weekday: 2, startMinute: 9 * 60, endMinute: 10 * 60 }] });
    const b = schedule({
      professionalId: 'b',
      workingHours: [{ weekday: 2, startMinute: 9 * 60 + 30, endMinute: 11 * 60 }],
      busy: [{ start: localMinuteToInstant(TUESDAY, 10 * 60, SP), end: localMinuteToInstant(TUESDAY, 10 * 60 + 30, SP) }],
    });
    const slots = computeAnySlots({ date: TUESDAY, rules, durationMinutes: 30, schedules: [a, b], now: NOW });
    expect(slots.map((s) => [hhmm(s.start), s.professionalIds])).toEqual([
      ['09:00', ['a']],
      ['09:30', ['a', 'b']],
      ['10:30', ['b']],
    ]);
  });

  it('retorna vazio quando ninguém trabalha', () => {
    expect(computeAnySlots({ date: TUESDAY, rules, durationMinutes: 30, schedules: [], now: NOW })).toEqual([]);
  });
});

describe('pickLeastBusyProfessional', () => {
  it('ordena candidatos por menos agendamentos no dia, mantendo a ordem em empates', () => {
    expect(pickLeastBusyProfessional(['a', 'b', 'c'], { a: 3, b: 1, c: 1 })).toEqual(['b', 'c', 'a']);
    expect(pickLeastBusyProfessional(['a', 'b'], {})).toEqual(['a', 'b']);
  });
});

describe('parseLocalDate', () => {
  it('rejeita datas inválidas', () => {
    expect(() => parseLocalDate('2026-02-30')).toThrow();
    expect(() => parseLocalDate('03/11/2026')).toThrow();
  });
});
