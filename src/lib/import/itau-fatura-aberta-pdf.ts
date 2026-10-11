import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * "Fatura Aberta" do cartão Itaú (Personnalité e outros), baixada pelo app/site antes de fechar.
 *
 * O PDF não sai linha a linha: primeiro vem a coluna inteira de data + descrição (páginas 1–2),
 * depois a coluna inteira de valores (páginas 4–5), na mesma ordem:
 *
 *   Fatura Aberta - Novembro/2026
 *   Lançamentos
 *   Data Lançamento
 *   01/10/2026 Pagamento Debito Automatico
 *   09/10/2026 Loja Exemplosao Paulobra
 *   ...
 *   Parcelamento Valor Titularidade
 *   R$ -9.443,69 Titular
 *   Parcela 1 de 3 R$ 39,16 Titular
 *   Subtotal R$ 6.287,65
 *
 * Nenhuma linha tem data e valor juntos, então o leitor genérico só achava o "Subtotal" e a fatura
 * inteira (52 compras) virava um lançamento só. Aqui a n-ésima data casa com o n-ésimo valor —
 * e só quando as duas listas têm o mesmo tamanho, senão não dá pra saber quem é de quem.
 *
 * Compra sai POSITIVA e pagamento NEGATIVO, como nas outras faturas (ver `isFaturaSummaryLine`).
 */

const DATA_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.+)$/;
const VALOR_RE = /^(?:Parcela\s+(\d{1,2})\s+de\s+(\d{1,2})\s+)?R\$\s*(-)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s+(?:Titular|Adicional|Dependente)\b/i;

export function isItauOpenInvoice(texto: string): boolean {
  return /Fatura Aberta\s*-\s*\p{L}+\/\d{4}/u.test(texto) && /Parcelamento\s+Valor\s+Titularidade/i.test(texto);
}

export function parseItauOpenInvoice(texto: string): ParsedTransaction[] {
  const datas: { date: string; description: string }[] = [];
  const valores: { valor: number; parcela: string | null }[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    const d = linha.match(DATA_RE);
    if (d) {
      datas.push({ date: `${d[3]}-${d[2]}-${d[1]}`, description: d[4].trim() });
      continue;
    }
    const v = linha.match(VALOR_RE);
    if (v) {
      const magnitude = parseBrazilianNumber(v[4]);
      valores.push({ valor: v[3] ? -magnitude : magnitude, parcela: v[1] ? `Parcela ${v[1]}/${v[2]}` : null });
    }
  }
  if (datas.length === 0 || datas.length !== valores.length) return [];
  return datas
    .map((d, i) => ({
      date: d.date,
      description: valores[i].parcela ? `${d.description} ${valores[i].parcela}` : d.description,
      amount: valores[i].valor,
    }))
    .filter((t) => t.amount !== 0 && !Number.isNaN(t.amount));
}
