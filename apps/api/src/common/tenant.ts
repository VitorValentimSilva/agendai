import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Multiempresa: o site informa qual negócio está sendo acessado neste header
 * (definido pelo proxy do Next a partir do subdomínio ou do link /n/slug).
 */
export const TENANT_HEADER = 'x-business-slug';

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Slugs que não podem ser usados por negócios (colidem com rotas/subdomínios do sistema). */
export const RESERVED_SLUGS = new Set([
  'www', 'api', 'app', 'admin', 'painel', 'n', 'cadastro', 'docs', 'static', 'assets', 'mail', 'email',
  'blog', 'ajuda', 'suporte', 'status', 'login', 'agendai', 'demo',
]);

export function normalizeSlug(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const slug = value.trim().toLowerCase();
  return SLUG_RE.test(slug) ? slug : undefined;
}

/** Slug do negócio da requisição pública (ou undefined → negócio padrão da instalação). */
export const TenantSlug = createParamDecorator((_: unknown, ctx: ExecutionContext): string | undefined => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const raw = req.headers[TENANT_HEADER];
  return normalizeSlug(Array.isArray(raw) ? raw[0] : raw);
});
