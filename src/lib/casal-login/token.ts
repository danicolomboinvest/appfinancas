import { createHash, randomBytes } from "node:crypto";

/**
 * O código do link do convite do par (/par/<código>).
 *
 * 32 bytes sorteados pelo sistema operacional: 256 bits, impossível de adivinhar ou de varrer.
 * O banco guarda só o SHA-256 (como a senha): quem lê uma cópia do banco não consegue montar um
 * link que funcione. O código em si só existe no link que a titular manda.
 *
 * Por que não o `convite-cadastro.ts` que já existe: aquele é um código ASSINADO e sem estado
 * (serve pra preencher o e-mail da compra no cadastro e vale 90 dias). O convite do par precisa
 * ser de uso único, cancelável pela titular e trocável no "Mandar de novo", e isso só dá com o
 * código guardado no banco. Do outro aproveitei a ideia de nunca pôr dado da pessoa no link.
 */

export const BYTES_DO_TOKEN = 32;

/** 32 bytes em base64url: sempre 43 caracteres, só letras, números, "-" e "_". */
const FORMATO = /^[A-Za-z0-9_-]{43}$/;

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function gerarTokenDoConvite(): { token: string; hash: string } {
  const token = randomBytes(BYTES_DO_TOKEN).toString("base64url");
  return { token, hash: hashDoToken(token) };
}

/**
 * O código tem a cara de um código nosso? Link cortado pelo WhatsApp, com espaço no fim ou com
 * lixo colado cai aqui antes de ir ao banco.
 */
export function tokenTemFormato(token: unknown): token is string {
  return typeof token === "string" && FORMATO.test(token);
}

/**
 * Limpa o que costuma vir grudado no código quando a pessoa copia e cola o link: espaço, ponto
 * final da frase, aspas. Não "conserta" código errado, só tira a sujeira das pontas.
 */
export function limparToken(bruto: unknown): string {
  if (typeof bruto !== "string") return "";
  let t = bruto.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    // Um "%" solto não é código nosso; segue como veio e o formato recusa.
  }
  return t.replace(/^["'“”‘’(<\s]+|["'“”‘’)>.,;:!?\s]+$/g, "");
}
