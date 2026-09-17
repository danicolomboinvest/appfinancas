import type { ParsedTransaction } from "./statement-parser";

export type DocKind = "extrato" | "fatura" | "unknown";

/**
 * O que o arquivo É, pelo nome e pelo conteúdo. O erro mais caro da importação, nos dados
 * reais, era fatura de cartão subida como extrato: toda compra virava renda. Quando dá pra
 * saber, o app avisa antes de gravar.
 */
export function detectDocKind(text: string, fileName?: string | null): { kind: DocKind; reason: string } {
  const name = (fileName ?? "").toLowerCase();
  const head = text.slice(0, 4000);
  const headLower = head.toLowerCase();

  // OFX declara o tipo de conta.
  if (/<creditcardmsgsrsv1>|<ccstmtrs>|<ccacctfrom>/i.test(head)) return { kind: "fatura", reason: "OFX de cartão de crédito" };
  if (/<bankmsgsrsv1>|<stmtrs>|<bankacctfrom>/i.test(head)) return { kind: "extrato", reason: "OFX de conta bancária" };

  // Cabeçalhos conhecidos.
  const firstLine = head.split(/\r?\n/).find((l) => l.trim())?.toLowerCase() ?? "";
  if (/^date\s*,\s*title\s*,\s*amount/.test(firstLine)) return { kind: "fatura", reason: "fatura do Nubank (CSV)" };
  if (/identificador/.test(firstLine) && /descri/.test(firstLine)) return { kind: "extrato", reason: "extrato do Nubank (CSV)" };
  if (/final do cart[aã]o|nome no cart[aã]o|parcela/.test(firstLine)) return { kind: "fatura", reason: "fatura de cartão (CSV)" };
  if (/saldo/.test(firstLine)) return { kind: "extrato", reason: "extrato com coluna de saldo" };

  // Texto (PDF/planilha): palavras que só uma fatura tem.
  if (/fatura|vencimento|limite dispon[ií]vel|pagamento m[ií]nimo/.test(headLower) && !/extrato/.test(headLower)) return { kind: "fatura", reason: "cabeçalho de fatura" };
  if (/extrato|saldo (anterior|do dia|final)|conta corrente/.test(headLower)) return { kind: "extrato", reason: "cabeçalho de extrato" };

  if (/fatura|invoice/.test(name) || /^nubank_\d{4}-\d{2}-\d{2}\.csv$/.test(name)) return { kind: "fatura", reason: "nome do arquivo" };
  if (/extrato|statement|^nu_\d+_/.test(name)) return { kind: "extrato", reason: "nome do arquivo" };
  return { kind: "unknown", reason: "" };
}

/**
 * Segunda opinião, pelos números: extrato bancário tem entradas e saídas; fatura de cartão é
 * quase toda de um lado só. Só vale com uma amostra razoável.
 */
export function looksLikeCardInvoice(txns: ParsedTransaction[]): boolean {
  if (txns.length < 8) return false;
  const positive = txns.filter((t) => t.amount > 0).length;
  const ratio = positive / txns.length;
  return ratio >= 0.9 || ratio <= 0.1;
}

/** "Total da fatura R$ 2.345,67" / "Total a pagar" / "Valor total": pra conferir se a leitura fechou. */
export function detectInvoiceTotal(text: string): number | null {
  const m = text.match(/(?:total\s+(?:da\s+fatura|desta\s+fatura|a\s+pagar|geral)|valor\s+total(?:\s+da\s+fatura)?)\s*[:\-]?\s*(?:R\$\s?)?(-?\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Linhas do arquivo que têm cara de valor em dinheiro: base do "achei X linhas mas só li Y". */
export function countMoneyLines(text: string): number {
  return text.split(/\r?\n/).filter((l) => /-?\d{1,3}(?:\.\d{3})*,\d{2}\b|-?\d+\.\d{2}\b/.test(l)).length;
}

/**
 * O arquivo traz a POSIÇÃO da carteira (quantidade, preço médio, cotas, saldo bruto)? Extratos
 * de conta investimento (BTG/EQI) também trazem abas de "Movimentações" e "Conta Corrente";
 * sem esta checagem eles eram barrados como extrato bancário, apesar de terem tudo.
 */
export function looksLikePortfolioPosition(text: string): boolean {
  return /pre[çc]o m[ée]dio|quantidade de cotas|posi[çc][ãa]o\s*>|saldo bruto/i.test(text);
}
