import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";

const PUBLIC_PATHS = ["/login", "/register", "/termos", "/privacidade", "/esqueci-senha", "/redefinir-senha"];

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
  // Deixa passar sem auth os assets do PWA, o browser/OS busca o manifest e os ícones sem a
  // sessão do usuário na hora de instalar o app; se caírem no redirect de login, a instalação
  // fica sem nome/ícone e o iOS não trata como app standalone. `icon.png` é o ícone de
  // convenção do Next (usado no <link rel="icon">, cai fora de /icons/ que já tava liberado) —
  // sem essa exceção, a aba do navegador pedia o ícone deslogada, o middleware respondia com um
  // redirect pro /login em vez da imagem, e o navegador caía pro favicon.ico como último recurso.
  matcher: [
    "/((?!api/auth|api/cron|api/webhooks|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.png|icons).*)",
  ],
};
