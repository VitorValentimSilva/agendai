import { NextResponse, type NextRequest } from "next/server";
import { resolveTenant, TENANT_COOKIE } from "@/lib/tenant";

const SESSION_COOKIE = "agendai_session";

/**
 * Proxy do Next (antigo middleware). Três responsabilidades:
 * 1. Multiempresa: descobre o negócio pelo subdomínio (navalha.seudominio.com) ou pelo link
 *    /n/slug (que grava um cookie e redireciona para a página do negócio).
 * 2. Encaminha para a API (rewrite /api/*) o slug do negócio e o IP real do cliente,
 *    este autenticado por PROXY_SECRET (a API ignora o header sem o segredo).
 * 3. Checagem otimista do painel: sem cookie de sessão, /admin/* vai para o login.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // /n/slug[/resto] → grava o negócio escolhido e redireciona para /resto
  const tenantLink = /^\/n\/([a-z0-9-]{1,40})(\/.*)?$/.exec(pathname);
  if (tenantLink) {
    const url = new URL(tenantLink[2] || "/", request.url);
    url.search = search;
    const res = NextResponse.redirect(url);
    res.cookies.set(TENANT_COOKIE, tenantLink[1]!, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
    return res;
  }

  if (pathname.startsWith("/api/")) {
    const headers = new Headers(request.headers);
    // Nunca confie nesses headers vindos do navegador
    headers.delete("x-business-slug");
    headers.delete("x-agendai-client-ip");
    headers.delete("x-agendai-proxy-secret");

    const tenant = resolveTenant(request.headers.get("host"), request.cookies.get(TENANT_COOKIE)?.value);
    if (tenant) headers.set("x-business-slug", tenant);

    const secret = process.env.PROXY_SECRET;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
    if (secret && ip) {
      headers.set("x-agendai-client-ip", ip);
      headers.set("x-agendai-proxy-secret", secret);
    }
    return NextResponse.next({ request: { headers } });
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/n/:path*", "/admin", "/admin/:path*"] };
