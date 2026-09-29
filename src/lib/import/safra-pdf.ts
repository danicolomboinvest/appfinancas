import type { AssetClass } from "@prisma/client";
import { detectFixedIncomeIndex, type ParsedHolding } from "./portfolio-parser";
import { parseBrazilianNumber } from "./statement-parser";

/**
 * "Relatório Mensal" de investimentos do Banco Safra em PDF.
 *
 * Não tem código de ativo (PETR4, HGLG11...): fundo e CDB aparecem pelo nome, e a palavra
 * "vencimento" aparece em todo canto (do CDB, do suitability). O app contava as palavras, achava
 * que era FATURA DE CARTÃO e recusava o arquivo na Carteira — uma cliente tentou 4 vezes.
 *
 *   Posição de Investimentos                                  ← nome e saldo de cada aplicação
 *   RENDA FIXA        168.789,51  766,07  168.023,43  100,00 ...  ← classe (não é ativo)
 *   CDB PRE EXEMPLO    40.000,00  -        39.999,99   23,70 ...
 *   FUNDO EXEMPLO RF   29.210,50  265,34   28.945,16   17,31 ...
 *   Fundos  Qtde de Cotas  Valor Cotas  Sld. Aplicado  Sld. Bruto ...
 *   FUNDO EXEMPLO RF   1.053,980763  27,714453  24.486,30  29.210,50 ...   ← cotas e investido
 *   CDB PRE EXEMPLO  BANCO X  PRE  - +14,37 31/08/2026  31/08/2028  40,00  40.000,00  40.000,00 ...
 *
 * O arquivo às vezes vem com o relatório repetido (mesmas páginas duas vezes): cada aplicação
 * entra uma vez só, senão a carteira dobrava.
 */

const MONEY = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`;
const POSICAO_RE = new RegExp(String.raw`^(.+?)\s+(${MONEY})\s+(?:${MONEY}|-)\s+(?:${MONEY}|-)\s+\d{1,3},\d{2}\b`);
const COTAS_RE = new RegExp(String.raw`^(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{4,8})\s+\d{1,3}(?:\.\d{3})*,\d{4,8}\s+(${MONEY})\s+(${MONEY})\b`);
/** Grupo da tabela (não é uma aplicação): define a classe das linhas de baixo. */
const CLASSE_RE = /^(RENDA FIXA|CURTO PRAZO|RENDA VARI[ÁA]VEL|MULTIMERCADOS?|PREVID[ÊE]NCIA|FUNDOS? IMOBILI[ÁA]RIOS?|INTERNACIONAL|A[ÇC][ÕO]ES|OUTROS)$/i;
const FIM_TABELA_RE = /^Relat[óo]rio Mensal\s*-/i;

export function isSafraMonthlyReport(texto: string): boolean {
  return /Relat[óo]rio Mensal/i.test(texto) && /Posi[çc][ãa]o de Investimentos/i.test(texto) && /\bSafra\b|\bSAF\b/i.test(texto);
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classeDoGrupo(grupo: string, nome: string, ehFundo: boolean): AssetClass {
  if (ehFundo) return "FUNDO";
  const g = grupo.toUpperCase();
  if (/TESOURO/.test(nome.toUpperCase())) return "TESOURO_DIRETO";
  if (g.includes("RENDA FIXA") || g.includes("CURTO PRAZO")) return "RENDA_FIXA";
  if (g.includes("IMOBILI")) return "FII";
  if (/A[ÇC][ÕO]ES|VARI/.test(g)) return "ACAO";
  if (g.includes("INTERNACIONAL")) return "INTERNACIONAL";
  return "OUTRO";
}

export function parseSafraMonthlyReport(texto: string): ParsedHolding[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").replace(/\s+/g, " ").trim());

  // 1) Nome e saldo bruto de cada aplicação, na tabela "Posição de Investimentos".
  const posicoes: { nome: string; valor: number; grupo: string }[] = [];
  const vistos = new Set<string>();
  const inicio = linhas.findIndex((l) => /^Posi[çc][ãa]o de Investimentos/i.test(l));
  if (inicio === -1) return [];
  let grupo = "";
  for (const linha of linhas.slice(inicio + 1)) {
    if (FIM_TABELA_RE.test(linha)) break;
    const m = linha.match(POSICAO_RE);
    if (!m) continue;
    const nome = m[1].trim();
    if (CLASSE_RE.test(nome)) {
      grupo = nome;
      continue;
    }
    if (/^(Sld|Patrim|Resumo)/i.test(nome) || vistos.has(nome.toUpperCase())) continue;
    vistos.add(nome.toUpperCase());
    posicoes.push({ nome, valor: parseBrazilianNumber(m[2]), grupo });
  }

  // 2) Fundo: quantidade de cotas e valor aplicado, na tabela "Fundos  Qtde de Cotas ...".
  const cotas = new Map<string, { qtd: number; aplicado: number }>();
  for (const linha of linhas) {
    const m = linha.match(COTAS_RE);
    if (!m || cotas.has(m[1].trim().toUpperCase())) continue;
    cotas.set(m[1].trim().toUpperCase(), { qtd: parseBrazilianNumber(m[2]), aplicado: parseBrazilianNumber(m[3]) });
  }

  return posicoes.map(({ nome, valor, grupo: g }) => {
    const fundo = cotas.get(nome.toUpperCase());
    if (fundo) {
      return { ticker: nome, quantity: fundo.qtd, value: valor, assetClass: classeDoGrupo(g, nome, true), investedValue: fundo.aplicado };
    }
    // 3) Título de renda fixa: indexador, quantidade e aplicado na tabela de detalhamento.
    const rf = linhas
      .map((l) =>
        l.match(
          new RegExp(
            String.raw`^${escapar(nome)}\s+.*?\b(PRE|CDI|IPCA\S*|SELIC|IGP\S*)\b(.*?)\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4}\s+([\d.]+(?:,\d+)?)\s+(${MONEY})\s+(${MONEY})`,
            "i",
          ),
        ),
      )
      .find(Boolean);
    const holding: ParsedHolding = { ticker: nome, quantity: 0, value: valor, assetClass: classeDoGrupo(g, nome, false) };
    if (rf) {
      holding.quantity = parseBrazilianNumber(rf[3]);
      holding.investedValue = parseBrazilianNumber(rf[4]);
      holding.fixedIncomeIndex = rf[1].toUpperCase() === "PRE" ? "PREFIXADO" : detectFixedIncomeIndex(`${rf[1]} ${rf[2]}`, nome);
    } else {
      holding.fixedIncomeIndex = detectFixedIncomeIndex("", nome);
    }
    return holding;
  });
}
