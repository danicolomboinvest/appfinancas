import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Confirmação do e-mail no cadastro.
 *
 * Existe porque o cadastro aceitava qualquer e-mail: quem soubesse o e-mail de uma compradora
 * que ainda não tinha criado a conta se cadastrava com ele e ganhava a área paga (a liberação é
 * pelo e-mail). Agora a conta nova só entra no app depois de clicar no link que chega na caixa
 * de entrada, e a área paga também exige isso (ver hasPremiumAccess).
 */

/**
 * Início da regra. Contas criadas ANTES disso continuam valendo sem confirmar: elas já usavam o
 * app, e trancar todo mundo de uma vez atrás de um e-mail que talvez nem chegue seria pior que o
 * risco. Ajustar pro horário do deploy (UTC) — conta criada entre este horário e o deploy cairia
 * na tela de confirmação sem ter recebido o e-mail (ela ainda consegue pedir pelo "Reenviar").
 */
export const CONFIRMACAO_DESDE = new Date("2026-09-30T15:00:00Z");

/** A conta pode usar o app? Não olha papel: quem chama decide se admin passa direto. */
export function emailConfirmado(user: { emailVerifiedAt: Date | null; createdAt: Date }): boolean {
  return user.emailVerifiedAt != null || user.createdAt < CONFIRMACAO_DESDE;
}

/** Validade do link: uma semana cobre quem só abre o e-mail no fim de semana. */
export const VALIDADE_DO_LINK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Prefixo assinado junto: o AUTH_SECRET também cifra a sessão, e sem isso uma assinatura feita
 * pra outro fim com o mesmo segredo poderia valer aqui. O "v1" deixa trocar o formato depois
 * sem aceitar link antigo com outro significado.
 */
const PROPOSITO = "confirmar-email:v1";

type Conteudo = { u: string; e: string; x: number };

/** Igual ao normalizeEmail da lista de acessos. Repetido aqui porque aquele arquivo usa este
 * (hasPremiumAccess) e importar de volta faria um ciclo — e puxaria o banco pros testes. */
function normalizar(email: string): string {
  return email.trim().toLowerCase();
}

function segredo(): string | null {
  // Os mesmos nomes que o Auth.js lê (o v5 usa AUTH_SECRET; NEXTAUTH_SECRET é o nome antigo).
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

function assinar(corpo: string, chave: string): Buffer {
  return createHmac("sha256", chave).update(`${PROPOSITO}.${corpo}`).digest();
}

/**
 * Monta o código do link. Sem tabela nova: o próprio código carrega de quem é, pra qual e-mail
 * e até quando vale, e a assinatura garante que ninguém inventa um. Lança sem segredo
 * configurado — melhor não mandar link nenhum do que mandar um que qualquer um forja.
 */
export function criarTokenDeConfirmacao(userId: string, email: string, agora: number = Date.now()): string {
  const chave = segredo();
  if (!chave) throw new Error("AUTH_SECRET não configurado: não dá pra assinar o link de confirmação.");
  const conteudo: Conteudo = { u: userId, e: normalizar(email), x: agora + VALIDADE_DO_LINK_MS };
  const corpo = Buffer.from(JSON.stringify(conteudo)).toString("base64url");
  return `${corpo}.${assinar(corpo, chave).toString("base64url")}`;
}

export type TokenDeConfirmacao = { userId: string; email: string };

/**
 * Lê o código do link: devolve de quem é, ou null se foi mexido, está vencido ou malformado.
 * NÃO confere se o e-mail ainda é o da conta — isso é com quem grava (ver confirmarEmail).
 */
export function lerTokenDeConfirmacao(token: unknown, agora: number = Date.now()): TokenDeConfirmacao | null {
  const chave = segredo();
  if (!chave || typeof token !== "string" || token.length > 1000) return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [corpo, assinatura] = partes;

  // Comparação em tempo constante: comparar string a string deixaria descobrir a assinatura
  // certa um byte por vez, medindo quanto cada tentativa demora pra ser recusada.
  const esperada = assinar(corpo, chave);
  const recebida = Buffer.from(assinatura, "base64url");
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

  let conteudo: Partial<Conteudo>;
  try {
    conteudo = JSON.parse(Buffer.from(corpo, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  if (typeof conteudo.u !== "string" || typeof conteudo.e !== "string" || typeof conteudo.x !== "number") return null;
  if (conteudo.x < agora) return null;
  return { userId: conteudo.u, email: conteudo.e };
}
