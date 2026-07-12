import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";

const PUBLIC_PATHS = ["/login", "/register"];

export default auth((req) => {
  const isPublicPath = PUBLIC_PATHS.some((path) => req.nextUrl.pathname.startsWith(path));

  if (!req.auth && !isPublicPath) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && isPublicPath) {
    return NextResponse.redirect(new URL("/mensal", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Deixa passar sem auth os assets do PWA — o browser/OS busca o manifest e os ícones sem a
  // sessão do usuário na hora de instalar o app; se caírem no redirect de login, a instalação
  // fica sem nome/ícone e o iOS não trata como app standalone.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons).*)"],
};
