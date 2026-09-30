import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Link do convite "Seu acesso está liberado" com o e-mail da compra já dentro.
 *
 * Existe porque a compradora abria o cadastro em branco, digitava OUTRO e-mail (o pessoal, o do
 * trabalho) e caía num app cheio de cadeados: a liberação é pelo e-mail da compra, e o dela não
 * batia. Com o e-mail vindo no link, o cadastro já nasce com o endereço certo.
 *
 * Código assinado em vez de `?email=` puro: o e-mail aberto no endereço ficaria legível nos logs
 * da Vercel e no histórico do navegador, e qualquer um montaria um link com o e-mail de outra
 * pessoa. A assinatura garante que o e-mail preenchido saiu do webhook. (O conteúdo é só
 * base64, não é segredo: quem tem o link já recebeu o convite nessa caixa de entrada.)
 *
 * Hoje o código só PREENCHE o campo. Como ele prova que o link veio desta caixa de entrada, dá
 * pra usar depois pra pular a confirmação do e-mail no cadastro — decisão pendente com a Dani.
 */

/** Validade longa: tem compradora que só cria a conta semanas depois de pagar. Vencido, o
 * cadastro só abre em branco, como era antes — nada quebra. */
export const VALIDADE_DO_CONVITE_MS = 90 * 24 * 60 * 60 * 1000;

/** Prefixo assinado junto, pelo mesmo motivo do link de confirmação: o AUTH_SECRET serve pra
 * outras assinaturas, e uma delas não pode valer aqui. */
const PROPOSITO = "convite-cadastro:v1";

type Conteudo = { e: string; x: number };

/** Igual ao normalizeEmail da lista de acessos (minúsculo, sem espaços). Repetido pra este
 * arquivo não puxar o Prisma — ele roda no webhook e na tela de cadastro. */
function normalizar(email: string): string {
  return email.trim().toLowerCase();
}

function segredo(): string | null {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

function assinar(corpo: string, chave: string): Buffer {
  return createHmac("sha256", chave).update(`${PROPOSITO}.${corpo}`).digest();
}

/** Monta o código. Sem segredo configurado devolve null (e não lança): o convite é enviado de
 * dentro do webhook da Hubla, e um link sem o e-mail é melhor do que convite nenhum. */
export function criarTokenDeConvite(email: string, agora: number = Date.now()): string | null {
  const chave = segredo();
  if (!chave) return null;
  const conteudo: Conteudo = { e: normalizar(email), x: agora + VALIDADE_DO_CONVITE_MS };
  const corpo = Buffer.from(JSON.stringify(conteudo)).toString("base64url");
  return `${corpo}.${assinar(corpo, chave).toString("base64url")}`;
}

/** Lê o código: devolve o e-mail da compra, ou null se foi mexido, venceu ou está malformado. */
export function lerTokenDeConvite(token: unknown, agora: number = Date.now()): string | null {
  const chave = segredo();
  if (!chave || typeof token !== "string" || token.length > 1000) return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [corpo, assinatura] = partes;

  // Tempo constante, pra ninguém descobrir a assinatura certa medindo a demora da recusa.
  const esperada = assinar(corpo, chave);
  const recebida = Buffer.from(assinatura, "base64url");
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

  let conteudo: Partial<Conteudo>;
  try {
    conteudo = JSON.parse(Buffer.from(corpo, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  if (typeof conteudo.e !== "string" || !conteudo.e.includes("@") || typeof conteudo.x !== "number") return null;
  if (conteudo.x < agora) return null;
  return conteudo.e;
}

/** O caminho do cadastro pro convite: com o código quando dá pra assinar, `/register` puro se não. */
export function caminhoDoCadastro(email: string, agora: number = Date.now()): string {
  const token = criarTokenDeConvite(email, agora);
  return token ? `/register?convite=${encodeURIComponent(token)}` : "/register";
}
