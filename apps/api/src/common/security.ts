import type { NextFunction, Request, Response } from 'express';
import { env, SESSION_COOKIE } from './env.js';

/** Cabeçalhos de segurança da API (a /docs precisa carregar o Swagger UI da CDN). */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (env.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path !== '/docs') {
    // Respostas JSON/ICS/CSV não precisam executar nada no navegador.
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  }
  next();
}

/** Hosts aceitos como Origin de requisições do painel. */
export function isAllowedOrigin(origin: string, requestHost: string | undefined): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (requestHost && url.host === requestHost) return true; // ex.: Swagger da própria API
  try {
    if (url.origin === new URL(env.webOrigin).origin) return true;
  } catch {
    // WEB_ORIGIN inválido: segue para as outras regras
  }
  const root = env.rootDomain;
  if (root && url.protocol === 'https:' && (url.hostname === root || url.hostname.endsWith(`.${root}`))) return true;
  if (!env.isProduction && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return true;
  return false;
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Defesa extra contra CSRF: uma requisição que altera dados e carrega o cookie de sessão
 * precisa vir de uma origem conhecida (o cookie já é SameSite=Lax; isto cobre navegadores antigos
 * e subdomínios). Webhooks e chamadas sem cookie não são afetados.
 */
export function originGuard(req: Request, res: Response, next: NextFunction): void {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  if (!UNSAFE.has(req.method) || !cookies?.[SESSION_COOKIE]) return next();
  const origin = req.headers.origin;
  if (!origin || isAllowedOrigin(origin, req.headers.host)) return next();
  res.status(403).json({ statusCode: 403, message: 'Origem da requisição não permitida.', error: 'Forbidden' });
}
