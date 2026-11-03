import { randomBytes, randomInt } from 'node:crypto';

// Sem caracteres ambíguos (0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código curto e legível para o cliente, ex.: "K7Q-4MZ". */
export function generateAppointmentCode(): string {
  let raw = '';
  for (let i = 0; i < 6; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

/** Token secreto (192 bits) usado no link "gerenciar agendamento". */
export function generateManageToken(): string {
  return randomBytes(24).toString('base64url');
}
