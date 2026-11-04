/** Multiempresa no site: subdomínio (navalha.seudominio.com) ou link /n/slug (cookie). */
export const TENANT_COOKIE = "agendai_tenant";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const IGNORED_SUBDOMAINS = new Set(["www", "app", "api", "admin"]);

export function rootDomain(): string {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").trim().toLowerCase().replace(/^\./, "");
}

/** Slug do subdomínio do domínio raiz (ou undefined). */
export function slugFromHost(host: string | null | undefined, root = rootDomain()): string | undefined {
  if (!host || !root) return undefined;
  const hostname = host.split(":")[0]!.toLowerCase();
  if (!hostname.endsWith(`.${root}`)) return undefined;
  const sub = hostname.slice(0, -root.length - 1);
  if (sub.includes(".") || IGNORED_SUBDOMAINS.has(sub) || !SLUG_RE.test(sub)) return undefined;
  return sub;
}

/** Subdomínio tem prioridade; sem ele, vale o negócio escolhido pelo link /n/slug. */
export function resolveTenant(host: string | null | undefined, cookie: string | undefined): string | undefined {
  const fromHost = slugFromHost(host);
  if (fromHost) return fromHost;
  return cookie && SLUG_RE.test(cookie) ? cookie : undefined;
}

/** Link público de agendamento do negócio. */
export function bookingLink(slug: string, origin: string): string {
  const root = rootDomain();
  return root ? `https://${slug}.${root}` : `${origin.replace(/\/$/, "")}/n/${slug}`;
}
