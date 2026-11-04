import { isBookingConflict, isOverlapViolation } from './prisma-errors.js';

describe('isBookingConflict', () => {
  it('reconhece a exclusion constraint, deadlock e falha de serialização', () => {
    expect(isOverlapViolation(new Error('violates exclusion constraint "Appointment_no_overlap"'))).toBe(true);
    expect(isBookingConflict(new Error('Code: `23P01`'))).toBe(true);
    expect(isBookingConflict(new Error('ERROR: deadlock detected (40P01)'))).toBe(true);
    expect(isBookingConflict(new Error('could not serialize access due to concurrent update'))).toBe(true);
  });

  it('não confunde outros erros', () => {
    expect(isBookingConflict(new Error('connection refused'))).toBe(false);
    expect(isBookingConflict('texto')).toBe(false);
  });
});
