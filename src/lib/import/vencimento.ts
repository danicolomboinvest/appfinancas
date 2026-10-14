/**
 * O vencimento impresso na fatura do cartão, pra já deixar escolhido o mês em que ela entra.
 *
 * A pergunta "de qual mês é esta fatura?" começava no mês de HOJE: quem subia em 30/09 a fatura
 * que vence em 10/10 deixava setembro, e as compras de outubro inteiras caíam no mês errado. O
 * que vale é quando a fatura é paga, e o dia do pagamento é o vencimento que o próprio PDF traz.
 *
 * Só procura data logo depois da palavra "vencimento" (ou do "FATURA 14 SET 2026" do topo da
 * fatura do Nubank). Nada de chutar pela data mais comum do arquivo: é uma sugestão que a pessoa
 * vê e pode trocar, e uma sugestão errada é pior que nenhuma.
 */

import { vencimientoArgentino } from "./argentina";

const MESES_CURTOS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};
const MESES_LONGOS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

// "Vencimento", "Data de vencimento", "Vencimento da fatura", "Vence em" — com dois-pontos, traço
// ou quebra de linha antes da data (o extrator de PDF põe o rótulo e o valor em linhas separadas).
const ROTULO = String.raw`(?:data\s+(?:de|do)\s+)?venc(?:imento|e\s+em)(?:\s+da\s+fatura)?\s*[:\-–]?\s*`;
const NUMERICA = new RegExp(String.raw`${ROTULO}(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)`, "gi");
const MES_CURTO = new RegExp(String.raw`(?:${ROTULO}|\bFATURA\s+)(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\s+(\d{4})`, "gi");
const MES_LONGO = new RegExp(String.raw`${ROTULO}(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})`, "gi");

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function dataValida(dia: number, mes: number, ano: number): string | null {
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(ano)) return null;
  if (mes < 1 || mes > 12 || dia < 1 || ano < 2000 || ano > 2100) return null;
  // 31/02 não existe: o Date "empurra" pra março, e a comparação pega isso.
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * O vencimento da fatura ("YYYY-MM-DD"), ou null quando o texto não diz. Vale o que aparece
 * PRIMEIRO no arquivo: o vencimento da fatura fica no topo, e datas de vencimento mais pra baixo
 * são de outra coisa (parcelamento da fatura, boleto de outra via).
 */
export function detectarVencimento(texto: string, nomeDoArquivo?: string | null): string | null {
  return (
    vencimentoComAno(texto) ??
    vencimentoNaLinhaDeBaixo(texto) ??
    vencimentoSemAno(texto) ??
    // Resumen de tarjeta argentino: "VENCIMIENTO ACTUAL 05-Nov-26".
    vencimientoArgentino(texto) ??
    (nomeDoArquivo ? vencimentoNoNomeDoArquivo(nomeDoArquivo) : null)
  );
}

/**
 * Tabela: "Vencimento" é o título de uma coluna e a data vem na linha de baixo.
 *   ;Cartão;;;;;Valor;;Vencimento;                      ← planilha da fatura do Itaú
 *   ;Itau Uniclass Visa - final 0000;;;;;R$ 5,302.55;;06/10/2026;
 *   Valor (parcial) Vencimento                            ← fatura aberta do Itaú (PDF)
 *   6.287,65 03/11/2026
 * Só quando a linha dos títulos fala em valor: a posição de investimentos do C6 tem uma coluna
 * "Vencimento" que é do CDB, não de fatura.
 */
function vencimentoNaLinhaDeBaixo(texto: string): string | null {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < linhas.length - 1; i++) {
    const titulos = linhas[i].split(/[;\t]/).map((c) => semAcento(c).trim().toLowerCase());
    const coluna = titulos.findIndex((c) => /(^|\s)vencimento$/.test(c));
    if (coluna < 0 || !/valor/i.test(linhas[i]) || /indexador|emissor/i.test(linhas[i])) continue;
    const celulas = linhas[i + 1].split(/[;\t]/);
    const celula = celulas.length === titulos.length ? celulas[coluna] : linhas[i + 1];
    const datas = [...(celula ?? "").matchAll(/(?<![\d/])(\d{2})\/(\d{2})\/(\d{4})(?![\d/])/g)];
    if (datas.length === 1) return dataValida(Number(datas[0][1]), Number(datas[0][2]), Number(datas[0][3]));
  }
  return null;
}

/**
 * "Vencimento: 15/09", sem o ano (BTG/EQI). O ano vem do que a fatura diz de si mesma ("fatura de
 * Junho de 2026") ou, sem isso, do ano que mais aparece nas datas completas do arquivo.
 */
function vencimentoSemAno(texto: string): string | null {
  const t = semAcento(texto);
  const m = t.match(new RegExp(String.raw`${ROTULO}(\d{1,2})\/(\d{1,2})(?![\d/])`, "i"));
  if (!m) return null;
  const mes = Number(m[2]);
  const daFatura = t.match(/\bfatura\s+de\s+([a-z]+)\s+de\s+(\d{4})\b/i);
  if (daFatura && MESES_LONGOS[daFatura[1].toLowerCase()]) {
    // A fatura de dezembro vence em janeiro do ano seguinte.
    const ano = Number(daFatura[2]) + (mes < MESES_LONGOS[daFatura[1].toLowerCase()] - 1 ? 1 : 0);
    return dataValida(Number(m[1]), mes, ano);
  }
  const contagem = new Map<number, number>();
  for (const d of t.matchAll(/(?<![\d/])\d{1,2}\/\d{1,2}\/(\d{4})(?!\d)/g)) contagem.set(Number(d[1]), (contagem.get(Number(d[1])) ?? 0) + 1);
  const ano = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return ano ? dataValida(Number(m[1]), mes, ano) : null;
}

/**
 * Arquivo sem a palavra "vencimento" (o CSV da fatura do Nubank só tem data, nome e valor), mas
 * que o banco batiza com a data do vencimento: "Nubank_2026-10-17.csv", "Fatura2026-11-05.pdf",
 * "2026-06-17_Fatura_Fulana.pdf" (BTG), "Fatura_05-10-2026.pdf" (C6). Só esses formatos: o
 * "Fatura_Itau_20261011-132518.pdf" é a hora do download, não o vencimento.
 */
function vencimentoNoNomeDoArquivo(nome: string): string | null {
  const iso = nome.match(/^(?:Nubank_|Fatura[_ -]?)(\d{4})-(\d{2})-(\d{2})\b/i) ?? nome.match(/^(\d{4})-(\d{2})-(\d{2})_Fatura(?![a-z])/i);
  if (iso) return dataValida(Number(iso[3]), Number(iso[2]), Number(iso[1]));
  const br = nome.match(/^Fatura[_ -](\d{2})-(\d{2})-(\d{4})\b/i);
  return br ? dataValida(Number(br[1]), Number(br[2]), Number(br[3])) : null;
}

function vencimentoComAno(texto: string): string | null {
  const t = semAcento(texto);
  const achados: { indice: number; data: string }[] = [];
  const guardar = (indice: number, data: string | null) => {
    if (data) achados.push({ indice, data });
  };
  for (const m of t.matchAll(NUMERICA)) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    guardar(m.index ?? 0, dataValida(Number(m[1]), Number(m[2]), ano));
  }
  for (const m of t.matchAll(MES_CURTO)) {
    guardar(m.index ?? 0, dataValida(Number(m[1]), MESES_CURTOS[m[2].toLowerCase()] ?? 0, Number(m[3])));
  }
  for (const m of t.matchAll(MES_LONGO)) {
    guardar(m.index ?? 0, dataValida(Number(m[1]), MESES_LONGOS[m[2].toLowerCase()] ?? 0, Number(m[3])));
  }
  if (achados.length === 0) return null;
  achados.sort((a, b) => a.indice - b.indice);
  return achados[0].data;
}
