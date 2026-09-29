/**
 * CSV que abre certo no Excel em português com dois cliques — é onde a aluna abre o arquivo.
 *
 * O formato "internacional" (vírgula separando colunas, ponto decimal, sem BOM) abria tudo numa
 * coluna só, "Mês" virava "MÃªs" e "2500.5" não era número. O Excel pt-BR espera:
 * - BOM UTF-8 no começo, senão lê o arquivo como Latin-1;
 * - ";" entre colunas (a vírgula é o separador decimal dele);
 * - valor com vírgula decimal ("2500,50").
 */

const BOM = "﻿";
const SEPARADOR = ";";

/** Uma célula: aspas só quando o texto tem separador, aspas ou quebra de linha. */
export function celulaCsv(valor: string): string {
  if (/[;"\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

/** Arquivo inteiro: BOM + cabeçalho + linhas, com ";" e quebra de linha do Windows. */
export function montarCsv(cabecalho: string[], linhas: string[][]): string {
  return BOM + [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(SEPARADOR)).join("\r\n");
}

/** Dinheiro com 2 casas e vírgula decimal, sem separador de milhar ("2500,50"). */
export function dinheiroCsv(valor: number | string | { toString(): string }): string {
  const n = Number(valor.toString());
  return Number.isFinite(n) ? n.toFixed(2).replace(".", ",") : "";
}

/** Quantidade (até 6 casas, sem zeros sobrando) com vírgula decimal ("10,5"). */
export function quantidadeCsv(valor: number | string | { toString(): string }): string {
  const n = Number(valor.toString());
  return Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6).replace(".", ",") : "";
}

/**
 * Data do dia no formato brasileiro. Em UTC porque é assim que o app grava e mostra a data do
 * lançamento (o dia do toISOString): no fuso do Brasil, meia-noite UTC viraria o dia anterior.
 */
export function dataCsv(data: Date | null): string {
  if (!data) return "";
  const [ano, mes, dia] = data.toISOString().slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** O tipo do lançamento como aparece no app, não o nome interno em inglês. */
export const TIPO_DO_LANCAMENTO: Record<string, string> = {
  INCOME: "Renda",
  EXPENSE: "Gasto",
  INVESTMENT_CONTRIBUTION: "Aporte",
};
