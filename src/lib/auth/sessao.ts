import { createHash } from "node:crypto";

/** Pra onde vai quem entra sem destino (ou com um destino que não dá pra confiar). */
export const DESTINO_PADRAO = "/mensal/foco";

/**
 * Marca curta da senha atual, guardada no token de sessão. Trocar a senha gera outro hash
 * bcrypt (salt novo), então a marca muda e as sessões abertas em outros aparelhos caem na
 * próxima requisição. É um resumo do hash, não o hash: o token viaja no cookie.
 */
export function versaoDaSenha(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

/**
 * A sessão ainda vale pra senha de agora? Token sem marca é de antes dessa checagem existir:
 * vale (e passa a carregar a marca atual), senão o deploy deslogava todo mundo de uma vez.
 */
export function sessaoValeParaSenha(marcaDoToken: string | undefined, marcaAtual: string): boolean {
  return !marcaDoToken || marcaDoToken === marcaAtual;
}

/**
 * Destino depois do login a partir do callbackUrl que o proxy colocou na URL. Só aceita
 * caminho do próprio app: um link "?callbackUrl=https://golpe.com" ou "//golpe.com" não pode
 * mandar a pessoa, já logada, pra fora. Voltar pro /login ou /register faria um laço.
 */
export function destinoDepoisDoLogin(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.length > 1000) return DESTINO_PADRAO;
  // "\" vira "/" em alguns navegadores ("/\golpe.com" = "//golpe.com").
  if (raw.startsWith("//") || raw.includes("\\")) return DESTINO_PADRAO;
  let url: URL;
  try {
    url = new URL(raw, "http://app.local");
  } catch {
    return DESTINO_PADRAO;
  }
  if (url.origin !== "http://app.local") return DESTINO_PADRAO;
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return DESTINO_PADRAO;
  if (url.pathname === "/register" || url.pathname.startsWith("/register/")) return DESTINO_PADRAO;
  return `${url.pathname}${url.search}${url.hash}`;
}
