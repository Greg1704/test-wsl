import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Guarda optimista a nivel edge: si no hay cookie de sesión, redirige a /login.
// La verificación real de la sesión ocurre en cada Server Component/Action.
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Rutas del grupo (dashboard). Agregar acá cada nueva sección protegida.
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/tarjetas",
    "/tarjetas/:path*",
    "/simulador",
  ],
};
