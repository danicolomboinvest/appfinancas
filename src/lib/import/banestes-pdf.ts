import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato do Banestes impresso do Internet Banking (PDF "Banestes - Internet Banking").
 *
 * O dia vem sozinho, em duas linhas, antes dos lançamentos daquele dia:
 *
 *   18                                               ← dia
 *   SET                                              ← mês
 *   SALDO ANTERIOR 	-190,60                         ← saldo: não é movimento
 *    PIX RECEBIDO 18/09/2026-16:59:09 	LOJA 	150,00
 *    LÍQUIDO DE VENCIMENTOS 	5.374,03               ← sem data nenhuma na linha
 *    PIX ENVIADO ... 	FULANO DA                    ← às vezes a descrição quebra e o valor
 *   SILVA                                               desce sozinho pra linha de baixo
 *   -60,00
 *
 * O leitor genérico só enxergava as linhas de Pix, que trazem a data no meio do texto. Salário,
 * depósito, débito automático e boleto — as linhas sem data — sumiam: uma cliente importou 11
 * de 42 lançamentos e ficou com o mês errado sem saber.
 *
 * "LANÇAMENTOS PREVISTOS" entra: o próprio total de saídas do cabeçalho conta com eles. Lá cada
 * linha traz a sua data, e é ela que vale.
 */

const MESES: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};

const DIA_RE = /^(\d{1,2})$/;
const MES_RE = /^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)$/;
const PERIODO_RE = /PER[IÍ]ODO:\s*\d{2}\/\d{2}\/(\d{4})/i;
const DATA_NA_LINHA_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
const VALOR = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`;
const VALOR_NO_FIM_RE = new RegExp(`^(.*?)\\t\\s*(${VALOR})$`);
const VALOR_SOZINHO_RE = new RegExp(`^(${VALOR})$`);
const SALDO_RE = /^SALDO\b/i;
const RUIDO_RE = [/Banestes Internet Banking/i, /^https?:\/\//i, /^-- \d+ of \d+ --$/];

export function isBanestesStatement(texto: string): boolean {
  return /Banestes Internet Banking/i.test(texto) && /DATA LAN[ÇC]AMENTO/i.test(texto) && /ENTRADAS E SA[ÍI]DAS/i.test(texto);
}

export function parseBanestesStatement(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  // As setinhas de entrada/saída do site viram caracteres "de uso privado" do PDF, invisíveis, numa
  // linha que parece vazia — e grudavam na descrição seguinte, escondendo o "SALDO" do começo.
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\p{Co}/gu, "").trim());
  const ano = texto.match(PERIODO_RE)?.[1] ?? String(refYear);
  const out: ParsedTransaction[] = [];

  let dentro = false;
  let previstos = false;
  let data: string | null = null;
  let pendente: string[] = [];

  const lancar = (descricaoPartes: string[], bruto: string) => {
    const descricao = descricaoPartes.join(" ").replace(/\s+/g, " ").trim();
    const valor = parseBrazilianNumber(bruto);
    if (!descricao || SALDO_RE.test(descricao) || Number.isNaN(valor) || valor === 0) return;
    const naLinha = previstos ? descricao.match(DATA_NA_LINHA_RE) : null;
    const quando = naLinha ? `${naLinha[3]}-${naLinha[2]}-${naLinha[1]}` : data;
    if (!quando) return;
    out.push({ date: quando, description: descricao, amount: valor });
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha) continue;
    if (!dentro) {
      if (/^DATA LAN[ÇC]AMENTO\b/i.test(linha)) dentro = true;
      continue;
    }
    if (/^SALDOS$/i.test(linha)) break;
    if (RUIDO_RE.some((re) => re.test(linha))) continue;
    if (/^LAN[ÇC]AMENTOS PREVISTOS$/i.test(linha)) {
      previstos = true;
      pendente = [];
      continue;
    }

    // "18" numa linha e "SET" na seguinte abrem o dia.
    if (DIA_RE.test(linha) && MES_RE.test(linhas[i + 1] ?? "")) {
      data = `${ano}-${MESES[linhas[i + 1]]}-${linha.padStart(2, "0")}`;
      pendente = [];
      i += 1;
      continue;
    }

    const sozinho = linha.match(VALOR_SOZINHO_RE);
    if (sozinho) {
      lancar(pendente, sozinho[1]);
      pendente = [];
      continue;
    }

    const noFim = linha.match(VALOR_NO_FIM_RE);
    if (noFim) {
      lancar([...pendente, noFim[1].replace(/\t/g, " ")], noFim[2]);
      pendente = [];
      continue;
    }

    if (SALDO_RE.test(linha)) {
      pendente = [];
      continue;
    }
    if (pendente.length < 3) pendente.push(linha.replace(/\t/g, " "));
  }

  return out;
}
