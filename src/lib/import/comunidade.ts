import type { ParentCategory } from "@prisma/client";
import { normalizeMerchant } from "./classify";

/**
 * O app aprendendo com as clientes, não só com cada uma: quando várias clientes DIFERENTES já
 * escolheram, cada uma sozinha, a mesma categoria pra uma loja, a próxima recebe a loja
 * categorizada. (Pedido da Dani em 02/10/2026: no primeiro arquivo, 76% dos gastos chegavam sem
 * categoria e a fila de revisão fazia gente desistir.)
 *
 * Os votos vêm SÓ das regras aprendidas (TransactionCategoryRule), que nascem de uma escolha da
 * pessoa — na revisão ou corrigindo depois. Os lançamentos não votam: o palpite do próprio app
 * ficaria lá sem ninguém mexer e viraria voto, e um erro se reforçaria sozinho.
 *
 * Cuidados:
 * - Pix e transferência nunca entram: o "nome da loja" ali é uma pessoa.
 * - Só com 3+ clientes diferentes e 80%+ de acordo. Loja que vende de tudo (Apple, Amazon) racha
 *   o voto e continua indo pra revisão.
 * - Cada cliente vale um voto por loja, por mais que ela compre lá.
 * Medido com as escolhas reais (cada cliente comparada ao voto das OUTRAS): 83% de acerto.
 */

export type Voto = { userId: string; pattern: string; parentCategory: ParentCategory };
/** Loja → categoria. `null` = a loja é conhecida, mas as clientes discordam: não chutar. */
export type RegrasDaComunidade = Map<string, ParentCategory | null>;

export const MIN_CLIENTES = 3;
export const ACORDO_MINIMO = 0.8;

const PIX_RE = /\b(pix|transfer[eê]ncia|transf|ted|doc)\b/i;

/** Palavras que não dizem QUAL é a loja: meio de pagamento, intermediário, cidade, "lançamento". */
const NAO_E_LOJA = new Set([
  "no", "na", "de", "da", "do", "das", "dos", "em", "com", "para", "pra", "pelo", "pela", "via", "www", "online",
  "enviado", "enviada", "recebido", "recebida", "transferencia", "transf", "boleto", "efetuado", "efetuada",
  "compra", "pagamento", "pagto", "pgto", "debito", "deb", "credito", "cartao", "pix", "ted", "doc", "saque", "estorno",
  "visa", "elo", "master", "mastercard", "nupay", "pagamentos", "agencia", "conta", "ltda", "eireli",
  "bar", "loja", "posto", "lanche", "casa", "lancamento", "fatura", "paga", "bill",
  // Intermediários de pagamento que vêm antes do nome da loja ("PG *LOJA", "EBN*CANVA", "JIM.COM*").
  "htm", "pag", "ebn", "mlp", "pagseguro", "pagbank", "jim", "hna", "ifd", "paypal",
  "brasil", "bra", "sao", "paulo", "rio", "janeiro",
]);

/** As palavras que identificam a loja, na ordem. Palavras de 1–2 letras ficam de fora ("mp", "br"). */
function palavrasDaLoja(texto: string): string[] {
  return normalizeMerchant(texto)
    .split(" ")
    .filter((p) => p.length > 2 && !NAO_E_LOJA.has(p));
}

/** Chave da loja: as duas primeiras palavras que identificam ("lojas americanas", "sem parar"). */
export function chaveDaLoja(texto: string): string | null {
  if (PIX_RE.test(texto)) return null;
  const palavras = palavrasDaLoja(texto);
  return palavras.length > 0 ? palavras.slice(0, 2).join(" ") : null;
}

export function montarRegrasDaComunidade(votos: Voto[]): RegrasDaComunidade {
  // loja → cliente → categoria (a última regra dela pra essa loja vale; uma cliente, um voto)
  const porLoja = new Map<string, Map<string, ParentCategory>>();
  for (const v of votos) {
    const chave = chaveDaLoja(v.pattern);
    if (!chave) continue;
    const clientes = porLoja.get(chave) ?? new Map<string, ParentCategory>();
    clientes.set(v.userId, v.parentCategory);
    porLoja.set(chave, clientes);
  }
  const regras: RegrasDaComunidade = new Map();
  for (const [chave, clientes] of porLoja) {
    if (clientes.size < MIN_CLIENTES) continue;
    const contagem = new Map<ParentCategory, number>();
    for (const c of clientes.values()) contagem.set(c, (contagem.get(c) ?? 0) + 1);
    const [categoria, n] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
    regras.set(chave, n / clientes.size >= ACORDO_MINIMO ? categoria : null);
  }
  return regras;
}

export function classificarPelaComunidade(descricao: string, regras: RegrasDaComunidade): ParentCategory | null {
  const chave = chaveDaLoja(descricao);
  return chave ? (regras.get(chave) ?? null) : null;
}
