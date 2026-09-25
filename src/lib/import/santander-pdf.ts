import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato mensal da conta do Santander em PDF ("Extrato Consolidado Inteligente").
 *
 * O PDF sai com a fonte desencontrada: o texto vem quebrado no meio das palavras e até das datas
 * ("EXT R ATO CO N S O LID AD O", "02 / 01"). Não é o arquivo inteiro letra por letra — por isso o
 * normalizador de texto espaçado não entra — e nenhum leitor achava uma data. A seção
 * "Movimentação" vem assim (colunas separadas por tabulação):
 *
 *   02 / 01 	LIQUIDO DE VENCIMENTO 	010102 	3.659,77       ← dia só no 1º lançamento do dia
 *   PIX ENVIADO                                              ← descrição desce por 1 ou 2 linhas
 *   Fulano de Tal
 *   - 	3.670,00- 	3.218,61                                 ← documento, valor, saldo (opcional)
 *   REMUNERACAO APLICACAO AUTOMATICA 	- 	0,01             ← mesmo dia, tudo numa linha
 *
 * O sinal vem ESCRITO: débito termina em "-", crédito não tem nada. Uma cliente subiu dois meses
 * desse extrato (78 e 72 linhas com valor) e viu zero lançamentos nas duas vezes.
 */

const MESES: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", março: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

/** Sem espaço nenhum: é assim que as palavras quebradas voltam a ser comparáveis. */
function colado(linha: string): string {
  return linha.replace(/\s+/g, "").toLowerCase();
}

export function isSantanderConsolidatedStatement(texto: string): boolean {
  const cabeca = colado(texto.slice(0, 3000));
  return cabeca.includes("extratoconsolidadointeligente") || cabeca.includes("extrato_pf_a4_inteligente");
}

/** "janei r o / 2026" no topo de cada página: o ano (e o mês) do extrato. */
function mesDeReferencia(linhas: string[]): { ano: string; mes: string } | null {
  for (const linha of linhas.slice(0, 15)) {
    const m = colado(linha).match(/^([a-zç]+)\/(\d{4})$/);
    if (m && MESES[m[1]]) return { ano: m[2], mes: MESES[m[1]] };
  }
  return null;
}

/** Dia no começo do lançamento, sozinho na primeira coluna: "02 / 01". */
const DIA_RE = /^(\d{2})\s*\/\s*(\d{2})$/;
/** Coluna de documento: "-" ou só dígitos. */
const DOCUMENTO_RE = /^(-|\d{3,})$/;
/** Coluna de valor: débito tem o "-" no fim. */
const VALOR_RE = /^(\d{1,3}(?:\.\d{3})*,\d{2})(-?)$/;

/** Cabeçalho e rodapé que se repetem a cada página, no meio da movimentação. */
function ehRuidoDePagina(linha: string): boolean {
  const c = colado(linha);
  return (
    /^--\d+of\d+--$/.test(c) ||
    c.startsWith("extratoconsolidadointeligente") ||
    c.startsWith("extrato_pf_a4") ||
    c.startsWith("balp_") ||
    /^pagina:\d+\/\d+$/.test(c) ||
    /^[a-zç]+\/\d{4}$/.test(c) ||
    /^data(descri|hist)/.test(c)
  );
}

/** Onde a movimentação termina: o aviso de saldo devedor ou o quadro de saldos. */
function fimDaMovimentacao(linha: string): boolean {
  const c = colado(linha);
  return c.startsWith("sevocênãotemlimite") || c.startsWith("saldosporperíodo") || c.startsWith("saldosporperiodo");
}

function descricaoLimpa(partes: string[]): string {
  return partes.join(" ").replace(/\s+/g, " ").trim() || "Lançamento";
}

export function parseSantanderConsolidatedStatement(
  texto: string,
  refYear: number = new Date().getFullYear(),
): ParsedTransaction[] {
  const linhas = texto.split(/\r?\n/);
  const referencia = mesDeReferencia(linhas);
  const out: ParsedTransaction[] = [];

  let dentro = false;
  let dia: string | null = null;
  let pendente: string[] = [];

  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (!linha) continue;
    if (!dentro) {
      if (colado(linha) === "movimentação" || colado(linha) === "movimentacao") dentro = true;
      continue;
    }
    if (fimDaMovimentacao(linha)) break;
    if (ehRuidoDePagina(linha)) continue;

    const celulas = linha.split("\t").map((c) => c.trim()).filter((c) => c !== "");
    const diaMatch = celulas[0]?.match(DIA_RE);
    if (diaMatch) {
      const mes = diaMatch[2];
      // O mês do cabeçalho manda no ano; um dia de dezembro num extrato de janeiro é do ano anterior.
      const ano = referencia
        ? Number(mes) > Number(referencia.mes) ? String(Number(referencia.ano) - 1) : referencia.ano
        : String(refYear);
      dia = `${ano}-${mes}-${diaMatch[1]}`;
      pendente = [];
      celulas.shift();
    }

    // O valor é a célula logo depois da coluna de documento; a que vem depois dele é o saldo.
    const i = celulas.findIndex((c, k) => k + 1 < celulas.length && DOCUMENTO_RE.test(c) && VALOR_RE.test(celulas[k + 1]));
    if (i === -1) {
      if (celulas.length > 0 && pendente.length < 3) pendente.push(celulas.join(" "));
      continue;
    }

    const [, numero, sinal] = celulas[i + 1].match(VALOR_RE)!;
    const magnitude = parseBrazilianNumber(numero);
    const descricao = descricaoLimpa([...pendente, ...celulas.slice(0, i)]);
    pendente = [];
    if (!dia || Number.isNaN(magnitude) || magnitude === 0) continue;
    out.push({ date: dia, description: descricao, amount: sinal === "-" ? -magnitude : magnitude });
  }

  return out;
}
