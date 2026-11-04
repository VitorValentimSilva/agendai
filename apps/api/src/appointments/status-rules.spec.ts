import { checkCustomerChange, checkStatusTransition } from './status-rules.js';

const now = new Date('2026-11-03T15:00:00Z');
const past = new Date('2026-11-03T12:00:00Z');
const future = new Date('2026-11-04T12:00:00Z');

describe('checkStatusTransition', () => {
  it('permite confirmar um agendamento futuro', () => {
    expect(checkStatusTransition({ status: 'SCHEDULED', startsAt: future }, 'CONFIRMED', now).ok).toBe(true);
  });

  it('não permite concluir um agendamento futuro', () => {
    const r = checkStatusTransition({ status: 'CONFIRMED', startsAt: future }, 'COMPLETED', now);
    expect(r).toEqual({ ok: false, reason: expect.stringContaining('ainda não começou') });
  });

  it('não permite marcar falta antes do horário', () => {
    expect(checkStatusTransition({ status: 'SCHEDULED', startsAt: future }, 'NO_SHOW', now).ok).toBe(false);
  });

  it('permite concluir e marcar falta depois do início', () => {
    expect(checkStatusTransition({ status: 'CONFIRMED', startsAt: past }, 'COMPLETED', now).ok).toBe(true);
    expect(checkStatusTransition({ status: 'SCHEDULED', startsAt: past }, 'NO_SHOW', now).ok).toBe(true);
  });

  it('cancelado e concluído são estados finais', () => {
    expect(checkStatusTransition({ status: 'CANCELED', startsAt: future }, 'SCHEDULED', now).ok).toBe(false);
    expect(checkStatusTransition({ status: 'COMPLETED', startsAt: past }, 'NO_SHOW', now).ok).toBe(false);
  });

  it('falta pode ser corrigida para concluído', () => {
    expect(checkStatusTransition({ status: 'NO_SHOW', startsAt: past }, 'COMPLETED', now).ok).toBe(true);
  });

  it('rejeita transição para o mesmo status', () => {
    expect(checkStatusTransition({ status: 'CONFIRMED', startsAt: future }, 'CONFIRMED', now).ok).toBe(false);
  });
});

describe('checkCustomerChange (política de cancelamento)', () => {
  it('permite alterar antes do prazo', () => {
    const r = checkCustomerChange({ status: 'SCHEDULED', startsAt: future }, 2, now);
    expect(r.ok).toBe(true);
    expect(r.deadline.toISOString()).toBe('2026-11-04T10:00:00.000Z');
  });

  it('bloqueia depois do prazo', () => {
    const startsSoon = new Date('2026-11-03T16:30:00Z'); // 1h30 depois de "agora"
    expect(checkCustomerChange({ status: 'CONFIRMED', startsAt: startsSoon }, 2, now).ok).toBe(false);
  });

  it('bloqueia agendamentos cancelados ou concluídos', () => {
    expect(checkCustomerChange({ status: 'CANCELED', startsAt: future }, 2, now).ok).toBe(false);
    expect(checkCustomerChange({ status: 'COMPLETED', startsAt: past }, 0, now).ok).toBe(false);
  });
});

describe('PENDING_PAYMENT', () => {
  it('pode ser confirmado ou cancelado, mas não concluído', () => {
    const a = { status: 'PENDING_PAYMENT' as const, startsAt: future };
    expect(checkStatusTransition(a, 'CONFIRMED', now).ok).toBe(true);
    expect(checkStatusTransition(a, 'CANCELED', now).ok).toBe(true);
    expect(checkStatusTransition(a, 'COMPLETED', now).ok).toBe(false);
  });
});
