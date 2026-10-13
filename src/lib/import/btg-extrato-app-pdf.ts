import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato da conta BTG Pactual impresso do APP (PDF "Comprovante_...", é a tela do celular
 * transformada em PDF). Cada lançamento ocupa várias linhas: a descrição quebrada, o valor e,
 * por último, o dia ("01OUT"). Depois do último lançamento de cada dia vem "Saldo do dia".
 *
 *   Saldo Anterior   R$ 3.224,92
 *   Pagamento
 *   Telefone IBC
 *   Vivo Sp
 *   -R$ 130,99
 *   01OUT
 *   Credito Juros R$ 0,15      ← às vezes o valor fica na mesma linha da descrição
 *   02OUT
 *   Saldo do dia   R$ 3.567,70
 *   Saldo Atual
 *   R$ 1.650,50
 *
 * O leitor genérico via as linhas com valor mas nenhuma com data junto (23 linhas, zero
 * lançamentos). Aqui a leitura só vale se o saldo anterior mais os lançamentos der o saldo atual.
 */

const MESES: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};
const MES_NOME: Record<string, string> = {
  janeiro: "01", fevereiro: "02", março: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};
const DIA_RE = /^(\d{2})(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)$/;
const VALOR_SOZINHO_RE = /^(-?)R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const VALOR_NO_FIM_RE = /^(.*\S)\s+(-?)R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const SALDO_ANTERIOR_RE = /^Saldo Anterior\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/i;

export function isBtgExtratoApp(texto: string): boolean {
  return (
    /^Extrato\b/m.test(texto) &&
    /^Saldo Anterior\s+R\$/im.test(texto) &&
    /^Saldo do dia\b/im.test(texto) &&
    /^\d{2}(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)$/m.test(texto)
  );
}

export function parseBtgExtratoApp(texto: string, refYear?: number): ParsedTransaction[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/[\t ]+/g, " ").trim());
  const ano =
    linhas.map((l) => l.match(/^\d{1,2} de ([a-zç]+) de (\d{4})/i)).find((m) => m && MES_NOME[m[1].toLowerCase()])?.[2] ??
    String(refYear ?? new Date().getFullYear());

  const inicio = linhas.findIndex((l) => SALDO_ANTERIOR_RE.test(l));
  if (inicio < 0) return [];
  const saldoAnterior = parseBrazilianNumber(linhas[inicio].match(SALDO_ANTERIOR_RE)![1]);

  // "Saldo Atual" fica no topo da tela, antes do "Saldo Anterior".
  const iAtual = linhas.findIndex((l) => /^Saldo Atual$/i.test(l));
  const atual = iAtual >= 0 ? linhas.slice(iAtual + 1).find((l) => l)?.match(VALOR_SOZINHO_RE) : null;
  const saldoAtual = atual ? (atual[1] ? -1 : 1) * parseBrazilianNumber(atual[2]) : null;

  const out: ParsedTransaction[] = [];
  let partes: string[] = [];
  let valor: number | null = null;

  for (let i = inicio + 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha) continue;
    if (/^Saldo do dia\b/i.test(linha)) {
      partes = [];
      valor = null;
      continue;
    }
    const dia = linha.match(DIA_RE);
    if (dia) {
      if (valor !== null && valor !== 0) {
        const descricao = partes.filter((p) => !/^Dados Conta$/i.test(p)).join(" ").replace(/\s+/g, " ").trim();
        out.push({ date: `${ano}-${MESES[dia[2]]}-${dia[1]}`, description: descricao || "Lançamento", amount: valor });
      }
      partes = [];
      valor = null;
      continue;
    }
    const sozinho = linha.match(VALOR_SOZINHO_RE);
    if (sozinho) {
      valor = (sozinho[1] ? -1 : 1) * parseBrazilianNumber(sozinho[2]);
      continue;
    }
    const noFim = linha.match(VALOR_NO_FIM_RE);
    if (noFim) {
      partes.push(noFim[1]);
      valor = (noFim[2] ? -1 : 1) * parseBrazilianNumber(noFim[3]);
      continue;
    }
    partes.push(linha);
  }

  // Só vale se fechar no centavo com os saldos impressos; senão o app lê pelos outros caminhos.
  if (saldoAtual === null) return [];
  const soma = out.reduce((a, t) => a + t.amount, 0);
  if (Math.round((saldoAnterior + soma) * 100) !== Math.round(saldoAtual * 100)) return [];
  return out;
}
