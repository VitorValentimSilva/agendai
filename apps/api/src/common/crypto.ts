import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';

/** Comparação em tempo constante (evita vazar o segredo pelo tempo de resposta). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function key(): Buffer {
  const raw = env.encryptionKey;
  if (raw) {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) throw new Error('ENCRYPTION_KEY deve ter 32 bytes em base64 (openssl rand -base64 32).');
    return buf;
  }
  if (env.isProduction) throw new Error('Variável de ambiente obrigatória ausente: ENCRYPTION_KEY');
  // Desenvolvimento/testes: deriva do JWT_SECRET para não exigir mais uma variável.
  return createHash('sha256').update(`agendai:${env.jwtSecret}`).digest();
}

/** Cifra um segredo de terceiros (tokens do Mercado Pago/Google) para guardar no banco. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Segredo cifrado em formato inválido.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** Token aleatório URL-safe (links secretos). */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}
