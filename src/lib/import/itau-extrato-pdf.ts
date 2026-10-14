import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato da conta do Itaú em PDF (app e internet banking), nos dois jeitos que chegaram em
 * 13/10/2026:
 *
 *   extrato conta corrente / lançamentos                      ← "extrato conta / lançamentos"
 *   data        lançamentos                     valor (R$)   saldo (R$)
 *   06/10/2026  SALDO ANTERIOR                                3.000,00
 *   07/10/2026  PAG BOLETO ESTACIONAMENTO EXEMPLO   -280,00
 *   07/10/2026  SALDO TOTAL DISPONÍVEL DIA                    2.720,00
 *   13/10/2026  PAG BOLETO COMPANHIA DE GAS DE SP              ← a descrição quebra e o valor
 *   COMGAS -12,40                                               desce pra linha de baixo
 *   posição consolidada                                        ← fim dos lançamentos
 *
 * O do app guarda a página por coluna (todas as datas, depois as descrições, depois os valores):
 * ele chega aqui já remontado pela posição (pdf-por-posicao.ts), uma linha por lançamento, com
 * tabulação entre as colunas.
 *
 * Antes: o leitor genérico perdia a linha quebrada e contava as linhas da "posição consolidada"
 * como lançamento que faltou (8 de 22, "leitura parcial"), e o do app saía com zero.
 */

const CABECALHO_RE = /^data\s+lan[çc]amentos\s+valor\s*\(R\$\)\s+saldo\s*\(R\$\)/im;
const LINHA_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.*)$/;
const VALOR = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`;
/** Fim da linha: o valor, e às vezes o saldo depois dele. */
const FIM_RE = new RegExp(String.raw`^(.*?)\s*(${VALOR})(?:\s+(${VALOR}))?$`);
/** Linhas de saldo: não são lançamento. */
const SALDO_RE = /^SALDO\s+(?:DO\s+DIA|ANTERIOR|TOTAL\s+DISPON[ÍI]VEL|FINAL|EM\s+CONTA)/i;
/** Onde a lista acaba (o resumo de baixo também tem valores, e não são lançamentos). */
const FIM_DA_LISTA_RE = /^(?:posi[çc][ãa]o consolidada|aviso!|lan[çc]amentos futuros|os saldos acima)/i;

export function isItauStatement(texto: string): boolean {
  return CABECALHO_RE.test(texto) && /extrato conta/i.test(texto);
}

export function parseItauStatement(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let dentro = false;
  let pendente: { date: string; descricao: string } | null = null;

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!linha) continue;
    if (CABECALHO_RE.test(bruta.replace(/\t/g, " "))) {
      dentro = true;
      pendente = null;
      continue;
    }
    if (!dentro) continue;
    if (FIM_DA_LISTA_RE.test(linha)) {
      dentro = false;
      pendente = null;
      continue;
    }

    const m = linha.match(LINHA_RE);
    if (m) {
      pendente = null;
      const date = `${m[3]}-${m[2]}-${m[1]}`;
      const resto = m[4];
      const fim = resto.match(FIM_RE);
      if (!fim) {
        // Descrição sem valor: ele vem na linha de baixo.
        if (!SALDO_RE.test(resto)) pendente = { date, descricao: resto };
        continue;
      }
      if (SALDO_RE.test(fim[1])) continue;
      empurrar(date, fim[1], fim[2]);
      continue;
    }
    // Continuação de uma descrição que quebrou: termina com o valor.
    if (pendente) {
      const fim = linha.match(FIM_RE);
      if (fim) {
        empurrar(pendente.date, `${pendente.descricao} ${fim[1]}`, fim[2]);
        pendente = null;
      } else if (pendente.descricao.length < 120) {
        pendente.descricao += ` ${linha}`;
      } else {
        pendente = null;
      }
    }
  }
  return out;

  function empurrar(date: string, descricao: string, valorTxt: string) {
    const valor = parseBrazilianNumber(valorTxt);
    if (!valor) return;
    out.push({ date, description: descricao.replace(/\s+/g, " ").trim() || "Lançamento", amount: valor });
  }
}
