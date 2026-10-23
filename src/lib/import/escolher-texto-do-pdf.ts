import { fechaComoFatura } from "./leitor-inteligente";
import { parseStatementComLeitor } from "./statement-parser";

/**
 * O PDF chega lido de dois jeitos: na ordem em que o arquivo guarda o texto (o de sempre) e
 * coluna por coluna, pela posição na página (pdf-layout.ts). Fica o de sempre, a menos que só
 * a leitura por coluna CONFIRA: a soma fecha no centavo com o total da fatura, ou o saldo do
 * extrato fecha linha a linha. Assim a leitura nova só entra quando prova que leu certo, e
 * nunca troca uma leitura que já conferia (23/10/2026: fatura de duas colunas, 20 de 55
 * compras lidas; pela posição, as 55 e a soma igual ao total).
 */
export function escolherTextoDoPdf(texto: string, layout: string | null | undefined, refYear?: number): string {
  if (!layout || layout === texto) return texto;
  if (confere(texto, refYear)) return texto;
  return confere(layout, refYear) ? layout : texto;
}

function confere(texto: string, refYear?: number): boolean {
  const { txns, leitor } = parseStatementComLeitor(texto, "pdf", refYear);
  if (txns.length === 0) return false;
  if (leitor === "pelo-saldo") return true;
  return fechaComoFatura(texto, txns) === "fechou";
}
