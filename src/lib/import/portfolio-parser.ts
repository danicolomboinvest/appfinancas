import type { AssetClass, FixedIncomeIndex } from "@prisma/client";
import { parseBrazilianNumber } from "./statement-parser";

/**
 * Parser de extrato/posição da corretora ou relatório da B3 (item 5.1). Identifica ativos pelo
 * código (ticker) e a quantidade, sem digitar posição por posição. Suporta:
 * - CSV simples (colunas código/quantidade/valor)
 * - texto solto contendo tickers da B3
 * - extratos em seções de banco/corretora (ex.: BTG "Extrato da Conta Investimento"), com
 *   várias tabelas por aba: Ações, BDRs, Fundos Listados, Renda Fixa (CDB/CRA/CRI/Debênture),
 *   Tesouro Direto e Portfólio de fundos.
 */

export type ParsedHolding = {
  ticker: string;
  quantity: number;
  /** Valor financeiro da posição, se encontrado; 0 quando o arquivo não traz. */
  value: number;
  /** Classe identificada pelo contexto do extrato (seção/coluna Tipo), quando disponível. */
  assetClass?: AssetClass;
  /** Quanto foi investido (preço médio × quantidade), quando o extrato informa. */
  investedValue?: number;
  /** Indexador da renda fixa (CDI/Selic → pós, IPCA+, ou prefixado), lido da coluna de taxa. */
  fixedIncomeIndex?: FixedIncomeIndex;
};

/**
 * Descobre o indexador a partir do texto da taxa ("101,00% do CDI", "IPCA + 9,50%",
 * "13,20% a.a.", "SELIC + 0,14%") e/ou do nome do título do Tesouro (LFT/LTN/NTN-B).
 * A ordem importa: IPCA e CDI/Selic têm prioridade; sobrando só uma taxa fixa → prefixado.
 */
export function detectFixedIncomeIndex(rateText: string, name = ""): FixedIncomeIndex | undefined {
  const t = `${rateText} ${name}`.toUpperCase();
  if (/IPCA|IGP|NTN-?B|NTNB/.test(t)) return "IPCA";
  if (/CDI|SELIC|\bLFT\b/.test(t)) return "POS_FIXADO";
  if (/PREFIX|\bLTN\b|NTN-?F|\d[.,]?\d*\s*%/.test(t)) return "PREFIXADO";
  return undefined;
}

/** Ticker B3: 4 letras + 1–2 dígitos (PETR4, ITUB3, HGLG11, BOVA11). */
const TICKER_RE = /\b([A-Z]{4}\d{1,2})\b/;

/** Classe pela terminação do ticker: 11 → FII (dominante na B3), 3/4/5/6 → ação (BDR incluso,
 * termina em 34), 1-5 letras sem dígito → ativo internacional (AAPL, VOO, SCHD — extrato da
 * Avenue e afins caem aqui), resto → outro. */
export function guessAssetClass(ticker: string): AssetClass {
  const clean = ticker.trim().toUpperCase();
  if (/11$/.test(clean)) return "FII";
  if (/[3456]$/.test(clean)) return "ACAO";
  if (/^[A-Z]{1,5}$/.test(clean)) return "INTERNACIONAL";
  return "OUTRO";
}

const QTY_HEADERS = ["quantidade", "qtd", "quant", "quantity", "posicao", "posição"];
const VALUE_HEADERS = ["valor", "financeiro", "value", "total", "posicao", "montante"];
const TICKER_HEADERS = ["codigo", "código", "ticker", "papel", "ativo", "symbol"];

function detectDelimiter(line: string): string {
  return [";", "\t", ","].reduce((best, d) => (line.split(d).length > line.split(best).length ? d : best), ";");
}

function findCol(headers: string[], needles: string[]): number {
  return headers.findIndex((h) => needles.some((n) => h.includes(n)));
}

/**
 * Número em formato brasileiro OU americano, extratos de banco (BTG) exportam Excel com
 * "1,520.80" enquanto B3/planilhas nacionais usam "1.520,80". Decide pelo último separador.
 * Exportado: o parser da declaração de IR usa pra quantidades ("1.000 QUOTAS" é mil, não um).
 */
export function parseFlexibleNumber(raw: string): number {
  const t = raw.replace(/[R$\s%]/g, "");
  if (!t || t === "-" || t === "–") return NaN;
  const hasComma = t.includes(",");
  const hasDot = t.includes(".");
  let normalized: string;
  if (hasComma && hasDot) {
    normalized =
      t.lastIndexOf(",") > t.lastIndexOf(".")
        ? t.replace(/\./g, "").replace(",", ".") // 1.520,80 → BR
        : t.replace(/,/g, ""); // 1,520.80 → US
  } else if (hasComma) {
    // Só vírgula: decimal se 1–2 casas ("19,01"); senão é milhar ("1,520" é raro, trata como US)
    normalized = /,\d{1,2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    normalized = t.replace(/\./g, ""); // 3.500 / 1.234.567 → milhar BR
  } else {
    normalized = t;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function parseCsvHoldings(lines: string[]): ParsedHolding[] {
  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const tickerCol = findCol(headers, TICKER_HEADERS);
  const qtyCol = findCol(headers, QTY_HEADERS);
  const valueCol = findCol(headers, VALUE_HEADERS);
  if (tickerCol === -1) return [];

  const holdings: ParsedHolding[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(delimiter).map((c) => c.trim());
    const tickerMatch = (cols[tickerCol] ?? "").toUpperCase().match(TICKER_RE);
    if (!tickerMatch) continue;
    const quantity = qtyCol !== -1 ? parseBrazilianNumber(cols[qtyCol] ?? "") : NaN;
    const value = valueCol !== -1 ? parseBrazilianNumber(cols[valueCol] ?? "") : NaN;
    holdings.push({
      ticker: tickerMatch[1],
      quantity: Number.isNaN(quantity) ? 0 : quantity,
      value: Number.isNaN(value) ? 0 : Math.abs(value),
    });
  }
  return holdings;
}

/** Texto solto: cada linha com um ticker; pega o 1º número como quantidade e o maior como valor. */
function parseTextHoldings(lines: string[]): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];
  for (const line of lines) {
    const upper = line.toUpperCase();
    const tickerMatch = upper.match(TICKER_RE);
    if (!tickerMatch) continue;
    const numbers = (line.match(/-?[\d.]+,\d+|\b\d+\b/g) ?? []).map(parseBrazilianNumber).filter((n) => !Number.isNaN(n));
    const quantity = numbers[0] ?? 0;
    const value = numbers.length > 1 ? Math.max(...numbers.slice(1)) : 0;
    holdings.push({ ticker: tickerMatch[1], quantity, value });
  }
  return holdings;
}

/** Soma posições repetidas do mesmo ticker (ex.: várias linhas de compra). */
function mergeByTicker(holdings: ParsedHolding[]): ParsedHolding[] {
  const map = new Map<string, ParsedHolding>();
  for (const h of holdings) {
    const existing = map.get(h.ticker);
    if (existing) {
      existing.quantity += h.quantity;
      existing.value += h.value;
      if (h.investedValue !== undefined) {
        existing.investedValue = (existing.investedValue ?? 0) + h.investedValue;
      }
    } else {
      map.set(h.ticker, { ...h });
    }
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Extrato em seções (BTG e similares)
// ---------------------------------------------------------------------------

/** O que a tabela ativa do momento representa, com o índice de cada coluna relevante. */
type ActiveTable =
  | { kind: "ticker"; tickerCol: number; qtyCol: number; valueCol: number; typeCol: number; avgPriceCol: number }
  | { kind: "rendaFixa"; nameCol: number; emissorCol: number; qtyCol: number; valueCol: number; taxaCol: number }
  | { kind: "fundo"; dateCol: number; qtyCol: number; valueCol: number };

const DATE_RE = /^\d{2}\/\d{2}\/\d{2,4}$/;

/** Nome do fundo sem o sufixo cadastral ("… - Classe CNPJ: 00.000…" e asteriscos). */
function cleanFundName(name: string): string {
  const base = name
    .replace(/\s*-\s*Classe CNPJ:.*$/i, "")
    .replace(/\s*-\s*C[óo]d\. Subclasse:.*$/i, "")
    .replace(/\*+$/, "")
    .trim();
  // "KINEA IPCA DINÂMICO II FUNDO DE INVESTIMENTO FINANCEIRO RENDA FIXA RESPONSABILIDADE
  // LIMITADA" → "KINEA IPCA DINÂMICO II": o resto é razão social, não identifica o fundo.
  const short = base.replace(/\s+FUNDO DE INVESTIMENTO\b.*$/i, "").trim();
  return short.length >= 3 ? short : base;
}

/** Classe pela SEÇÃO do extrato, que é mais confiável que a terminação do ticker: KLBN11 em
 * "Posição > Ações" é uma unit (ação), DIVD11 em "Posição > ETF" é ETF (o app guarda como
 * Fundo, igual ao cadastro manual), BDR vira internacional. Sem seção que decida, a coluna
 * Tipo (FII) e a terminação continuam valendo. */
function sectionAssetClass(section: string, tipo: string, ticker: string): AssetClass {
  if (tipo === "FII") return "FII";
  if (/\betf\b/.test(section)) return "FUNDO";
  if (/\bbdr\b/.test(section)) return "INTERNACIONAL";
  if (/a[çc][õo]es/.test(section)) return "ACAO";
  return guessAssetClass(ticker);
}

/**
 * Extratos de banco (ex.: BTG) vêm como várias tabelas em seções: "Posição > Ações",
 * "Posição > Fundos Listados", "Posição > CRA", "Posição > TESOURO DIRETO - LFT"…
 * Cada seção tem seu cabeçalho e linhas de dados, encerradas por uma linha "Total".
 * Seções de Movimentação/Detalhamento repetem as posições e são puladas (evita duplicar),
 * assim como Aluguel de ações (as ações alugadas já contam na posição).
 */
function parseSectionedHoldings(lines: string[]): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];
  let skipping = false;
  let section = "";
  let table: ActiveTable | null = null;
  let pendingFundName: string | null = null;
  // Só entra no modo "seções" depois de ver um marcador ("Posição >" etc.), CSVs simples
  // sem marcador seguem no caminho clássico (parseCsvHoldings), que já os trata bem.
  let sawSection = false;
  // "Detalhamento > <fundo>": lista cada compra com o "Valor de Compra"; a soma é o investido
  // do fundo (a posição só traz o saldo atual). Guardado por nome e aplicado no fim.
  const fundInvested = new Map<string, number>();
  let detailFund: string | null = null;
  let detailCol = -1;

  for (const line of lines) {
    const cells = line.split(";").map((c) => c.trim());
    const nonEmpty = cells.filter((c) => c !== "");
    if (nonEmpty.length === 0) continue;
    const first = nonEmpty[0];
    const firstLower = first.toLowerCase();

    // Marcadores de seção
    if (/^(movimenta|detalhamento|posi[cç][õo]es detalhadas)/.test(firstLower)) {
      skipping = true;
      table = null;
      detailFund = /^detalhamento\s*>/.test(firstLower) ? cleanFundName(first.split(">")[1] ?? "") : null;
      detailCol = -1;
      continue;
    }
    if (/^posi[cç][ãa]o\s*>/.test(firstLower) || /^posi[cç][õo]es?$/.test(firstLower)) {
      sawSection = true;
      section = firstLower.includes(">") ? first.split(">")[1].trim().toLowerCase() : "";
      skipping = section.includes("aluguel");
      table = null;
      pendingFundName = null;
      detailFund = null;
      continue;
    }
    if (detailFund && skipping) {
      const lower = cells.map((c) => c.toLowerCase());
      if (/^total\b/.test(firstLower)) {
        detailFund = null;
        detailCol = -1;
      } else if (detailCol === -1) {
        detailCol = lower.findIndex((c) => c.includes("valor de compra"));
      } else if (DATE_RE.test(first)) {
        const bought = parseFlexibleNumber(cells[detailCol] ?? "");
        if (!Number.isNaN(bought)) fundInvested.set(detailFund, (fundInvested.get(detailFund) ?? 0) + bought);
      }
      continue;
    }
    if (skipping || !sawSection) continue;

    // Linha "Total …" encerra a tabela ativa
    if (/^total\b/.test(firstLower)) {
      table = null;
      pendingFundName = null;
      continue;
    }

    // Detecção de cabeçalho de tabela
    const lower = cells.map((c) => c.toLowerCase());
    const hasCell = (needle: string) => lower.some((c) => c.includes(needle));
    if (hasCell("código") && (hasCell("qtde") || hasCell("quantidade"))) {
      const saldoCol = lower.findIndex((c) => c.includes("saldo bruto"));
      table = {
        kind: "ticker",
        tickerCol: lower.findIndex((c) => c.includes("código")),
        qtyCol: lower.findIndex((c) => c.includes("qtde") || c.includes("quantidade")),
        valueCol: saldoCol !== -1 ? saldoCol : findCol(lower, VALUE_HEADERS),
        typeCol: lower.findIndex((c) => c === "tipo"),
        avgPriceCol: lower.findIndex((c) => c.includes("preço médio") || c.includes("preco medio")),
      };
      continue;
    }
    if (hasCell("emissor") && lower.includes("ativo") && hasCell("quantidade")) {
      table = {
        kind: "rendaFixa",
        nameCol: lower.indexOf("ativo"),
        emissorCol: lower.findIndex((c) => c.includes("emissor")),
        qtyCol: lower.findIndex((c) => c.includes("quantidade")),
        valueCol: lower.findIndex((c) => c.includes("saldo bruto")),
        taxaCol: lower.findIndex((c) => c.includes("taxa")),
      };
      continue;
    }
    if (hasCell("data referência") && hasCell("quantidade de cotas")) {
      table = {
        kind: "fundo",
        dateCol: lower.findIndex((c) => c.includes("data referência")),
        qtyCol: lower.findIndex((c) => c.includes("quantidade de cotas")),
        valueCol: lower.findIndex((c) => c.includes("saldo bruto")),
      };
      pendingFundName = null;
      continue;
    }

    if (!table) continue;

    // Linhas de dados
    if (table.kind === "ticker") {
      // "ABCB4*": o asterisco marca "calculado em data anterior", não faz parte do código.
      const ticker = (cells[table.tickerCol] ?? "").replace(/\*+$/, "").trim().toUpperCase();
      if (!/^[A-Z]{4}\d{1,2}$/.test(ticker)) continue;
      const quantity = parseFlexibleNumber(cells[table.qtyCol] ?? "");
      const value = table.valueCol !== -1 ? parseFlexibleNumber(cells[table.valueCol] ?? "") : NaN;
      const tipo = table.typeCol !== -1 ? (cells[table.typeCol] ?? "").toUpperCase() : "";
      const avgPrice = table.avgPriceCol !== -1 ? parseFlexibleNumber(cells[table.avgPriceCol] ?? "") : NaN;
      const qty = Number.isNaN(quantity) ? 0 : quantity;
      holdings.push({
        ticker,
        quantity: qty,
        value: Number.isNaN(value) ? 0 : Math.abs(value),
        assetClass: sectionAssetClass(section, tipo, ticker),
        // Preço médio × quantidade = quanto foi investido (base do lucro/prejuízo).
        investedValue: !Number.isNaN(avgPrice) && qty > 0 ? avgPrice * qty : undefined,
      });
    } else if (table.kind === "rendaFixa") {
      const name = cells[table.nameCol] ?? "";
      if (!name || name === "-") continue;
      const quantity = parseFlexibleNumber(cells[table.qtyCol] ?? "");
      const value = table.valueCol !== -1 ? parseFlexibleNumber(cells[table.valueCol] ?? "") : NaN;
      if (Number.isNaN(quantity) && Number.isNaN(value)) continue;
      const isTesouro = section.includes("tesouro") || /^(LFT|LTN|NTN)/i.test(name);
      const emissor = cells[table.emissorCol] ?? "";
      const taxa = table.taxaCol !== -1 ? (cells[table.taxaCol] ?? "") : "";
      holdings.push({
        // Tesouro usa o nome do título (LFT, NTNB-P); o resto ganha o emissor pra ficar legível.
        ticker: isTesouro || !emissor ? name : `${name} (${emissor})`,
        quantity: Number.isNaN(quantity) ? 0 : quantity,
        value: Number.isNaN(value) ? 0 : Math.abs(value),
        assetClass: isTesouro ? "TESOURO_DIRETO" : "RENDA_FIXA",
        // Indexador da taxa ("101% do CDI" → pós, "IPCA + 9,5%" → IPCA, "13% a.a." → prefixado).
        fixedIncomeIndex: detectFixedIncomeIndex(taxa, name),
      });
    } else {
      // Portfólio de fundos: linha de NOME (célula única, sem data) alternada com linha de DADOS
      const firstCell = cells[table.dateCol] ?? "";
      if (DATE_RE.test(firstCell)) {
        if (!pendingFundName) continue;
        const quantity = parseFlexibleNumber(cells[table.qtyCol] ?? "");
        const value = table.valueCol !== -1 ? parseFlexibleNumber(cells[table.valueCol] ?? "") : NaN;
        holdings.push({
          ticker: pendingFundName,
          quantity: Number.isNaN(quantity) ? 0 : quantity,
          value: Number.isNaN(value) ? 0 : Math.abs(value),
          assetClass: "FUNDO",
        });
        pendingFundName = null;
      } else if (nonEmpty.length === 1) {
        pendingFundName = cleanFundName(first);
      }
    }
  }

  for (const h of holdings) {
    if (h.assetClass === "FUNDO" && h.investedValue === undefined && fundInvested.has(h.ticker)) {
      h.investedValue = fundInvested.get(h.ticker);
    }
  }
  return holdings;
}

// ---------------------------------------------------------------------------
// Planilha de Alocação (modelo próprio da Dani, distribuído pra alunas preencherem à mão)
// ---------------------------------------------------------------------------

/** Categoria (coluna "Classificação" da planilha) → classe do app. Por trecho, não por
 * igualdade exata: cada aluna digita ("Renda Fixa - CDI", "Renda Fixa - Pós fixado"...),
 * o texto exato varia, a intenção por trás não. */
function classifyAllocationCategory(text: string): AssetClass {
  const t = text.toUpperCase();
  if (t.includes("RENDA FIXA")) return "RENDA_FIXA";
  if (t.includes("TESOURO")) return "TESOURO_DIRETO";
  if (t.includes("IMOBILI") || t.includes(" FII")) return "FII";
  if (t.includes("AÇ") || t.includes("ACA") || t.includes("AÇÕES") || t.includes("ACOES")) return "ACAO";
  if (t.includes("CRIPTO") || t.includes("BITCOIN")) return "CRIPTO";
  // "Exterior - Com/Sem Hedge": investimento fora do Brasil, seja ETF/ação direta ou fundo
  // que investe lá fora — mapeia pro bucket "Exterior" da Estratégia da Carteira.
  if (t.includes("EXTERIOR") || t.includes("INTERNACIONAL")) return "INTERNACIONAL";
  if (t.includes("FUNDO")) return "FUNDO";
  return "OUTRO";
}

/**
 * Planilha de Alocação: modelo próprio da Dani (não é extrato de corretora) — cada aluna
 * preenche à mão uma linha por ativo, agrupada por "Classificação" (célula mesclada, só a
 * primeira linha do grupo carrega o texto; nas de baixo herda-se o último valor visto).
 * Reconhecida pelo cabeçalho ("Classificação" + "Ativo" nas mesmas colunas) — não tem
 * quantidade de cotas, só o valor investido/atual em R$, diferente do extrato de corretora.
 * Encerra na linha de TOTAL (sem nome de ativo, com um valor grande de "Invest. Inicial");
 * o que vem depois (rodapé, anotações soltas, uma segunda tabela vazia de outro propósito)
 * não é lido.
 */
function parseAllocationTemplate(lines: string[]): ParsedHolding[] {
  const rows = lines.map((line) => line.split(";"));
  const headerIdx = rows.findIndex((cells) => {
    const lower = cells.map((c) => c.trim().toLowerCase());
    return lower.some((c) => c.includes("classifica")) && lower.some((c) => c === "ativo");
  });
  if (headerIdx === -1) return [];

  const header = rows[headerIdx].map((c) => c.trim().toLowerCase());
  const classCol = header.findIndex((c) => c.includes("classifica"));
  const nameCol = header.findIndex((c) => c === "ativo");
  const initialCol = header.findIndex((c) => c.includes("invest") && c.includes("inicial"));
  const currentCol = header.findIndex((c) => c.includes("preço atual") || c.includes("preco atual"));
  if (nameCol === -1) return [];

  const holdings: ParsedHolding[] = [];
  let currentClass = "";
  for (const cells of rows.slice(headerIdx + 1)) {
    const classText = classCol !== -1 ? (cells[classCol] ?? "").trim() : "";
    if (classText) currentClass = classText; // célula mesclada: herda o grupo até mudar

    const name = (cells[nameCol] ?? "").trim();
    const investedValue = initialCol !== -1 ? parseFlexibleNumber(cells[initialCol] ?? "") : NaN;

    // Linha de TOTAL: sem nome de ativo, mas com um valor grande na coluna de investido —
    // encerra a tabela; o resto é rodapé (anotações soltas, segunda tabela vazia).
    if (!name && !Number.isNaN(investedValue) && investedValue > 0) break;
    if (!name) continue; // linha divisória do grupo, sem ativo de verdade

    const currentValue = currentCol !== -1 ? parseFlexibleNumber(cells[currentCol] ?? "") : NaN;
    // "Preço atual" fica vazio pra aporte recém-feito (ainda sem valorização registrada) —
    // cai pro valor investido, em vez de zerar o ativo.
    const value = !Number.isNaN(currentValue) && currentValue > 0 ? currentValue : Math.max(0, investedValue || 0);

    holdings.push({
      ticker: name,
      quantity: 0, // a planilha não registra quantidade de cotas, só valor financeiro
      value,
      assetClass: classifyAllocationCategory(currentClass),
      investedValue: Number.isNaN(investedValue) ? undefined : investedValue,
      fixedIncomeIndex: detectFixedIncomeIndex("", name),
    });
  }
  return holdings;
}

export function parsePortfolioStatement(content: string): ParsedHolding[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  // 1º: Planilha de Alocação própria da Dani (Classificação + Ativo + Preço atual) — cada
  // aluna preenche à mão, sem quantidade de cotas.
  const allocation = parseAllocationTemplate(lines);
  if (allocation.length > 0) return mergeByTicker(allocation);

  // 2º: extrato em seções (BTG e similares), só produz resultado se achar as tabelas típicas.
  const sectioned = parseSectionedHoldings(lines);
  if (sectioned.length > 0) return mergeByTicker(sectioned);

  // Se a 1ª linha parece cabeçalho com coluna de código, trata como CSV estruturado.
  const firstLower = lines[0].toLowerCase();
  const looksCsv = TICKER_HEADERS.some((h) => firstLower.includes(h)) && /[;,\t]/.test(lines[0]);

  const raw = looksCsv ? parseCsvHoldings(lines) : parseTextHoldings(lines);
  return mergeByTicker(raw);
}
