import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import { destinoDepoisDoLogin } from "@/lib/auth/sessao";

// /confirmar-email é o destino do link do cadastro: abre no navegador do celular, quase sempre
// sem sessão, e quem vale ali é o código assinado do link.
const PUBLIC_PATHS = ["/login", "/register", "/termos", "/privacidade", "/esqueci-senha", "/redefinir-senha", "/suporte", "/confirmar-email"];

// Só estas mandam quem já está logada pra dentro do app. As outras públicas abrem com ou sem
// sessão: o link "Criar nova senha" do e-mail costuma abrir no navegador onde ela está logada
// (e sumia sem aviso, levando junto o único jeito de trocar a senha), e Termos, Privacidade e
// Suporte precisam ser legíveis de dentro do app.
const AUTH_ONLY_PATHS = ["/login", "/register"];

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!req.auth && !isPublicPath) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    // Com a query junto: "/mensal/2026/9?aba=x" do e-mail volta inteiro depois do login.
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && AUTH_ONLY_PATHS.some((path) => pathname.startsWith(path))) {
    const destino = destinoDepoisDoLogin(req.nextUrl.searchParams.get("callbackUrl"));
    return NextResponse.redirect(new URL(destino, req.nextUrl.origin));
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
