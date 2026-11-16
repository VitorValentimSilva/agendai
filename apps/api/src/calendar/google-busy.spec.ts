import { busyFromGoogleEvents } from './google-busy.js';

describe('busyFromGoogleEvents', () => {
  const TZ = 'America/Sao_Paulo';

  it('considera eventos com horário e ignora os do Agendaí, livres, cancelados e recusados', () => {
    const busy = busyFromGoogleEvents(
      [
        { start: { dateTime: '2026-11-20T10:00:00-03:00' }, end: { dateTime: '2026-11-20T11:30:00-03:00' } },
        { start: { dateTime: '2026-11-20T14:00:00-03:00' }, end: { dateTime: '2026-11-20T15:00:00-03:00' }, extendedProperties: { private: { agendaiAppointmentId: 'x' } } },
        { start: { dateTime: '2026-11-20T15:00:00-03:00' }, end: { dateTime: '2026-11-20T16:00:00-03:00' }, transparency: 'transparent' },
        { start: { dateTime: '2026-11-20T16:00:00-03:00' }, end: { dateTime: '2026-11-20T17:00:00-03:00' }, status: 'cancelled' },
        { start: { dateTime: '2026-11-20T17:00:00-03:00' }, end: { dateTime: '2026-11-20T18:00:00-03:00' }, attendees: [{ self: true, responseStatus: 'declined' }] },
      ],
      TZ,
    );
    expect(busy).toEqual([{ start: new Date('2026-11-20T13:00:00Z'), end: new Date('2026-11-20T14:30:00Z') }]);
  });

  it('dia inteiro ocupado bloqueia o dia no fuso do negócio (fim exclusivo)', () => {
    const busy = busyFromGoogleEvents([{ start: { date: '2026-11-21' }, end: { date: '2026-11-22' } }], TZ);
    expect(busy).toEqual([{ start: new Date('2026-11-21T03:00:00Z'), end: new Date('2026-11-22T03:00:00Z') }]);
  });
});
