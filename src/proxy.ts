import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";

// Páginas de autenticação: abertas para quem não tem sessão, mas quem já está logado é
// mandado pro app (não faz sentido ver login/cadastro logado).
const AUTH_PATHS = ["/login", "/register"];

// Páginas públicas de marketing: abertas para todos, logados ou não (ex.: a "bio" do
// Instagram, que é a porta de entrada antes do site/app).
const OPEN_PATHS = ["/bio"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));
  const isOpenPath = OPEN_PATHS.some((path) => pathname.startsWith(path));

  if (!req.auth && !isAuthPath && !isOpenPath) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && isAuthPath) {
    return NextResponse.redirect(new URL("/inicio", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
