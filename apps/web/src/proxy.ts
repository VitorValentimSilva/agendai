import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "agendai_session";

/**
 * Checagem otimista: sem cookie de sessão, /admin/* vai para o login.
 * A validação real do JWT acontece na API (401 → o painel volta ao login).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
