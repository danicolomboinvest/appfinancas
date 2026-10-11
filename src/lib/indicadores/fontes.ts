/**
 * Os números de fora que a Carteira mostra, cada um com a fonte e a hora (regra "sem número
 * inventado", seção 7 do plano da versão nova):
 *
 * - Banco Central, SGS: série 12 (CDI ao dia), 433 (IPCA ao mês) e 432 (meta Selic ao ano);
 * - Tesouro Transparente (dados abertos do Tesouro Nacional): "Preços e taxas dos títulos".
 *
 * Aqui só a leitura e a conta, sem banco: dá para testar com o texto que as fontes devolvem.
 */

export const FONTE_BCB = "Banco Central";
export const FONTE_TESOURO = "Tesouro Transparente";

export const SERIE_CDI = 12;
export const SERIE_IPCA = 433;
export const SERIE_SELIC = 432;

export const URL_SGS = (serie: number, ultimos: number) =>
  `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/${ultimos}?formato=json`;

export const URL_TESOURO_PRECOS =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv";

/** "09/10/2026" → 2026-10-09 à meia-noite UTC (o formato das colunas @db.Date). */
export function dataBr(texto: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "0,050788" ou "0.050788" → 0.050788. */
export function numeroBr(texto: string): number | null {
  const t = texto.trim();
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
}

export type PontoSgs = { data: Date; valor: number };

/** A resposta do SGS ([{ data: "07/10/2026", valor: "0.050788" }]), em ordem de data. */
export function lerSgs(json: unknown): PontoSgs[] {
  if (!Array.isArray(json)) return [];
  const pontos: PontoSgs[] = [];
  for (const linha of json) {
    if (!linha || typeof linha !== "object") continue;
    const { data, valor } = linha as { data?: unknown; valor?: unknown };
    const d = typeof data === "string" ? dataBr(data) : null;
    const v = typeof valor === "string" ? numeroBr(valor) : typeof valor === "number" ? valor : null;
    if (d && v !== null) pontos.push({ data: d, valor: v });
  }
  return pontos.sort((a, b) => a.data.getTime() - b.data.getTime());
}

/** CDI ao dia (em %, série 12) para ao ano, em fração: 252 dias úteis. 0,050788% ao dia ≈ 13,65% ao ano. */
export function cdiAoAno(cdiAoDiaPct: number): number {
  return Math.pow(1 + cdiAoDiaPct / 100, 252) - 1;
}

/** IPCA dos últimos 12 meses (série 433, % ao mês), composto, em fração. Precisa dos 12 meses. */
export function ipcaDozeMeses(pontos: PontoSgs[]): { valor: number; ate: Date } | null {
  const ultimos = pontos.slice(-12);
  if (ultimos.length < 12) return null;
  const valor = ultimos.reduce((acc, p) => acc * (1 + p.valor / 100), 1) - 1;
  return { valor, ate: ultimos[ultimos.length - 1].data };
}

export type TituloDoTesouro = {
  /** "Tesouro IPCA+", "Tesouro Selic", "Tesouro Prefixado", "Tesouro IPCA+ com Juros Semestrais"... */
  tipo: string;
  vencimento: Date;
  dataBase: Date;
  /** Taxa de compra da manhã, em % ao ano (no Selic, o ágio/deságio sobre a Selic). */
  taxaCompra: number | null;
  /** Preço unitário de venda (o que o título vale hoje, antes do IR e da taxa da B3). */
  puVenda: number | null;
};

/**
 * Lê o CSV de preços e taxas do Tesouro e devolve só os títulos do dia mais recente. O arquivo
 * tem a história inteira desde 2002 (cerca de 15 MB); os mais novos vêm primeiro, mas a função
 * não depende disso: guarda o dia mais recente que achar.
 */
export function lerPrecosDoTesouro(csv: string): TituloDoTesouro[] {
  const linhas = csv.split(/\r?\n/);
  const cab = (linhas.shift() ?? "").split(";").map((c) => c.trim());
  const col = (nome: string) => cab.indexOf(nome);
  const iTipo = col("Tipo Titulo");
  const iVenc = col("Data Vencimento");
  const iBase = col("Data Base");
  const iTaxa = col("Taxa Compra Manha");
  const iPuVenda = col("PU Venda Manha");
  if ([iTipo, iVenc, iBase].some((i) => i < 0)) return [];
  let maisRecente = 0;
  const porDia = new Map<number, TituloDoTesouro[]>();
  for (const linha of linhas) {
    if (!linha.trim()) continue;
    const c = linha.split(";");
    const base = dataBr(c[iBase] ?? "");
    const venc = dataBr(c[iVenc] ?? "");
    if (!base || !venc) continue;
    const t = base.getTime();
    if (t < maisRecente) continue;
    if (t > maisRecente) maisRecente = t;
    const lista = porDia.get(t) ?? [];
    lista.push({
      tipo: (c[iTipo] ?? "").trim(),
      vencimento: venc,
      dataBase: base,
      taxaCompra: iTaxa >= 0 ? numeroBr(c[iTaxa] ?? "") : null,
      puVenda: iPuVenda >= 0 ? numeroBr(c[iPuVenda] ?? "") : null,
    });
    porDia.set(t, lista);
  }
  return porDia.get(maisRecente) ?? [];
}

/** A chave de um título no banco: "tesouro:Tesouro IPCA+:2035-05-15". */
export function chaveDoTitulo(t: Pick<TituloDoTesouro, "tipo" | "vencimento">): string {
  return `tesouro:${t.tipo}:${t.vencimento.toISOString().slice(0, 10)}`;
}

/**
 * Qual título do Tesouro é o ativo dela, pelo nome que ela deu ("Tesouro IPCA+ 2035",
 * "Tesouro Selic 2029", "Tesouro Prefixado 2031", "IPCA+ com juros 2035"). Casa o tipo e o ano
 * do vencimento; sem os dois, não casa (melhor não mostrar do que mostrar o título errado).
 */
export function acharTitulo(nome: string, titulos: Pick<TituloDoTesouro, "tipo" | "vencimento">[]): string | null {
  const n = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const ano = /\b(20\d{2})\b/.exec(n)?.[1];
  if (!ano) return null;
  const juros = /juros|semestra/.test(n);
  const tipo = /renda\+|renda mais/.test(n)
    ? "Tesouro Renda+"
    : /educa/.test(n)
      ? "Tesouro Educa+"
      : /ipca/.test(n)
        ? juros
          ? "Tesouro IPCA+ com Juros Semestrais"
          : "Tesouro IPCA+"
        : /selic/.test(n)
          ? "Tesouro Selic"
          : /prefixado|pre-fixado|pré/.test(n)
            ? juros
              ? "Tesouro Prefixado com Juros Semestrais"
              : "Tesouro Prefixado"
            : null;
  if (!tipo) return null;
  const achado = titulos.filter((t) => t.tipo.startsWith(tipo) && String(t.vencimento.getUTCFullYear()) === ano);
  // "Tesouro Renda+" tem um nome por vencimento ("Tesouro Renda+ Aposentadoria Extra"): o primeiro serve.
  const exato = achado.find((t) => t.tipo === tipo) ?? achado[0];
  return exato ? chaveDoTitulo(exato) : null;
}

const FUSO = "America/Sao_Paulo";
const diaEmBrasilia = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const ddmm = (d: Date, fuso = FUSO) => d.toLocaleDateString("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit" });

/**
 * O "quando" de um número de fora, para escrever ao lado dele:
 * - buscado hoje: a data a que ele se refere ("09/10"), ou a hora da busca quando `comHora`;
 * - a busca de hoje falhou e vale o último: "de ontem, 09/10" (ou "de 07/10" se for mais velho).
 * Nunca esconde que o número é velho.
 */
export function quandoDoIndicador(ind: { referenteA: Date; buscadoEm: Date }, agora: Date = new Date(), comHora = false): { texto: string; velho: boolean } {
  const hoje = diaEmBrasilia(agora);
  if (diaEmBrasilia(ind.buscadoEm) === hoje) {
    const hora = ind.buscadoEm.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
    return { texto: comHora ? `hoje · ${hora}` : ddmm(ind.referenteA, "UTC"), velho: false };
  }
  const ontem = diaEmBrasilia(new Date(agora.getTime() - 24 * 60 * 60 * 1000));
  const quando = diaEmBrasilia(ind.buscadoEm) === ontem ? `de ontem, ${ddmm(ind.buscadoEm)}` : `de ${ddmm(ind.buscadoEm)}`;
  return { texto: quando, velho: true };
}

/** 0.1365 → "13,65%". */
export function porcento(fracao: number, casas = 2): string {
  return `${(fracao * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}
