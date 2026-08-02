import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Rotas de página que exigem sessão válida (antes, a checagem só existia
// no cliente, via um valor em localStorage que qualquer pessoa podia forjar).
const PROTECTED_PAGE_PREFIX = "/dashboard";

// Rotas de API restritas ao papel "master".
const MASTER_ONLY_API_PREFIXES = ["/api/users", "/api/dashboard", "/api/clientes"];

// Rotas de API que exigem sessão válida, de qualquer papel.
const AUTH_REQUIRED_API_PREFIXES = ["/api/campaigns", "/api/carousel"];

// No Next.js 16 o antigo "middleware.ts" foi renomeado para "proxy.ts"
// (função exportada "proxy"). É este arquivo — src/proxy.ts — que o
// framework carrega; comentários em outras rotas que mencionam
// "src/middleware.ts" estão se referindo a este mesmo arquivo.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  const isProtectedPage = pathname.startsWith(PROTECTED_PAGE_PREFIX);
  const isMasterOnlyApi = MASTER_ONLY_API_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRequiredApi = AUTH_REQUIRED_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtectedPage && !session) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isMasterOnlyApi) {
    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (session.role !== "master") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
  }

  if (isAuthRequiredApi && !session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (session) {
    // Encaminha a identidade verificada para as rotas de API via headers
    // internos. O cliente não consegue forjar isso: o middleware roda antes
    // do handler e reconstrói o objeto de headers a partir daqui.
    const forwardedHeaders = new Headers(req.headers);
    forwardedHeaders.set("x-session-user-id", session.sub);
    forwardedHeaders.set("x-session-name", session.name);
    forwardedHeaders.set("x-session-role", session.role);
    return NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/users/:path*", "/api/campaigns/:path*", "/api/carousel/:path*"],
};
