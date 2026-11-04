/** Leitura centralizada e tipada das variáveis de ambiente. */
function required(name: string, fallbackForDev?: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV !== 'production' && fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
  get port() {
    return int('PORT', 3001);
  },
  get jwtSecret() {
    return required('JWT_SECRET', 'dev-only-insecure-secret-change-me');
  },
  get webOrigin() {
    return process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? '';
  },
  /** Slug do negócio servido pelas rotas públicas (instalação white-label = 1 negócio). */
  get businessSlug() {
    return process.env.BUSINESS_SLUG ?? 'navalha-de-ouro';
  },
  /** Segredo compartilhado com o proxy do Next para repassar o IP real do cliente. */
  get proxySecret() {
    return process.env.PROXY_SECRET ?? '';
  },
  /** Domínio raiz dos subdomínios (ex.: agendai.com.br → navalha.agendai.com.br). Opcional. */
  get rootDomain() {
    return (process.env.ROOT_DOMAIN ?? '').trim().toLowerCase().replace(/^\./, '');
  },
  /** URL pública da API (usada em webhooks e no OAuth do Google). */
  get publicApiUrl() {
    return (process.env.PUBLIC_API_URL ?? `http://localhost:${int('PORT', 3001)}`).replace(/\/$/, '');
  },
  /** Chave para cifrar tokens de terceiros (32 bytes em base64). Em dev, derivada do JWT_SECRET. */
  get encryptionKey() {
    return process.env.ENCRYPTION_KEY ?? '';
  },
  get throttleLimit() {
    return int('THROTTLE_LIMIT', 60);
  },
  get bookingThrottleLimit() {
    return int('BOOKING_THROTTLE_LIMIT', 10);
  },
};

export const SESSION_COOKIE = 'agendai_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
