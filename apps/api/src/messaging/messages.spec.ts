import { parseReply, phoneVariants, reminderText, waitlistText } from './messages.js';

describe('parseReply', () => {
  it('entende botões do template com o id do agendamento', () => {
    expect(parseReply({ buttonPayload: 'CONFIRMAR:abc' })).toEqual({ kind: 'confirm', appointmentId: 'abc' });
    expect(parseReply({ buttonPayload: 'CANCELAR:xyz' })).toEqual({ kind: 'cancel', appointmentId: 'xyz' });
  });

  it('entende texto livre em pt-BR', () => {
    expect(parseReply({ text: '1' }).kind).toBe('confirm');
    expect(parseReply({ text: 'Sim, confirmo!' }).kind).toBe('confirm');
    expect(parseReply({ text: '2' }).kind).toBe('cancel');
    expect(parseReply({ text: 'Não vou poder, pode cancelar' }).kind).toBe('cancel');
    expect(parseReply({ text: 'Quero CANCELAR' }).kind).toBe('cancel');
    expect(parseReply({ text: 'qual o endereço?' }).kind).toBe('unknown');
    expect(parseReply({}).kind).toBe('unknown');
  });
});

describe('phoneVariants', () => {
  it('gera o número com e sem o nono dígito', () => {
    expect(phoneVariants('5519999990000').sort()).toEqual(['551999990000', '5519999990000'].sort());
    expect(phoneVariants('551999990000').sort()).toEqual(['551999990000', '5519999990000'].sort());
    expect(phoneVariants('14155550000')).toEqual(['14155550000']);
  });
});

describe('textos', () => {
  const base = {
    customerName: 'João da Silva',
    businessName: 'Barbearia X',
    serviceName: 'Corte',
    professionalName: 'Rafael',
    dateLabel: 'quinta-feira, 5 de novembro',
    time: '14:30',
    manageUrl: 'https://site/meu-agendamento/t',
  };

  it('lembrete pede confirmação só quando ainda não confirmado', () => {
    expect(reminderText({ ...base, askConfirmation: true })).toContain('Responda *1*');
    expect(reminderText({ ...base, askConfirmation: false })).not.toContain('Responda');
    expect(reminderText({ ...base, askConfirmation: true })).toMatch(/^Olá, João!/);
  });

  it('aviso de vaga da fila de espera traz o link', () => {
    expect(waitlistText({ customerName: 'Ana', businessName: 'B', serviceName: 'Corte', dateLabel: 'amanhã', bookUrl: 'https://x' })).toContain('https://x');
  });
});
