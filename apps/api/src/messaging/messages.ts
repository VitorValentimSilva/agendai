/** Textos e interpretação de respostas do WhatsApp — funções puras (testadas). */

export interface ReminderInfo {
  customerName: string;
  businessName: string;
  serviceName: string;
  professionalName: string;
  /** "quinta-feira, 5 de novembro" */
  dateLabel: string;
  /** "14:30" */
  time: string;
  manageUrl: string;
  askConfirmation: boolean;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function reminderText(r: ReminderInfo): string {
  const lines = [
    `Olá, ${firstName(r.customerName)}! Lembrete do seu horário em *${r.businessName}*:`,
    `${r.serviceName} com ${r.professionalName}, ${r.dateLabel} às ${r.time}.`,
    '',
    r.askConfirmation
      ? 'Responda *1* para *confirmar* ou *2* para *cancelar*.'
      : 'Seu horário está confirmado. Até lá!',
    `Remarcar ou cancelar: ${r.manageUrl}`,
  ];
  return lines.join('\n');
}

export function waitlistText(args: { customerName: string; businessName: string; serviceName: string; dateLabel: string; bookUrl: string }): string {
  return [
    `Olá, ${firstName(args.customerName)}! Abriu vaga em *${args.businessName}* para ${args.serviceName} em ${args.dateLabel}.`,
    'Quem agendar primeiro garante o horário:',
    args.bookUrl,
  ].join('\n');
}

export type ReplyIntent = { kind: 'confirm' | 'cancel'; appointmentId?: string } | { kind: 'unknown' };

const CONFIRM_WORDS = ['1', 'sim', 's', 'confirmo', 'confirmar', 'confirmado', 'ok', 'vou', 'estarei'];
const CANCEL_WORDS = ['2', 'nao', 'n', 'cancelar', 'cancela', 'cancelo', 'desmarcar'];

/**
 * Entende a resposta do cliente: botão do template ("CONFIRMAR:<id>"/"CANCELAR:<id>")
 * ou texto livre ("1", "sim", "2", "cancelar"...).
 */
export function parseReply(input: { text?: string; buttonPayload?: string }): ReplyIntent {
  const payload = input.buttonPayload?.trim();
  if (payload) {
    const [action, id] = payload.split(':');
    if (action === 'CONFIRMAR') return { kind: 'confirm', appointmentId: id || undefined };
    if (action === 'CANCELAR') return { kind: 'cancel', appointmentId: id || undefined };
  }
  const text = (input.text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim();
  if (!text) return { kind: 'unknown' };
  const first = text.split(/\s+/)[0]!;
  if (CANCEL_WORDS.includes(first) || text.includes('cancel')) return { kind: 'cancel' };
  if (CONFIRM_WORDS.includes(first) || text.includes('confirm')) return { kind: 'confirm' };
  return { kind: 'unknown' };
}

/**
 * Variações do número brasileiro: o WhatsApp às vezes entrega o wa_id sem o nono dígito
 * (5519999990000 ↔ 551999990000).
 */
export function phoneVariants(digits: string): string[] {
  const d = digits.replace(/\D/g, '');
  const out = new Set([d]);
  const m13 = /^55(\d{2})9(\d{8})$/.exec(d);
  if (m13) out.add(`55${m13[1]}${m13[2]}`);
  const m12 = /^55(\d{2})(\d{8})$/.exec(d);
  if (m12) out.add(`55${m12[1]}9${m12[2]}`);
  return [...out];
}
