import type { ParentCategory } from "@prisma/client";

export type VoiceEntryCategory = "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";

export type ParsedVoiceEntry = {
  category: VoiceEntryCategory;
  parentCategory: ParentCategory | null;
  amount: number | null;
  description: string;
};

/**
 * Palavras-chave faladas por categoria — vocabulário do dia a dia, não os rótulos formais de
 * SUBCATEGORIES (ex.: "uber" em vez de "Aplicativo"). Comparado sempre sem acento (ver `normalize`).
 */
const CATEGORY_KEYWORDS: Record<ParentCategory, string[]> = {
  MORADIA: ["aluguel", "condominio", "luz", "energia", "agua", "gas", "internet", "iptu", "reforma"],
  ALIMENTACAO: [
    "mercado", "supermercado", "restaurante", "ifood", "lanche", "padaria", "feira",
    "almoco", "janta", "jantar", "comida",
  ],
  TRANSPORTE: ["uber", "99", "gasolina", "combustivel", "onibus", "metro", "estacionamento", "pedagio", "taxi"],
  SAUDE: ["farmacia", "remedio", "medico", "consulta", "dentista", "academia", "plano de saude"],
  LAZER: ["cinema", "show", "viagem", "streaming", "netflix", "bar", "balada", "presente", "passeio"],
  EDUCACAO: ["curso", "livro", "faculdade", "mensalidade", "escola"],
  FINANCEIRO: ["poupanca", "cdb", "tesouro", "acoes", "investimento", "seguro"],
};

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15,
  dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
};

const TENS: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
};

const HUNDREDS: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500,
  seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Converte um número por extenso em português (ex.: "quinhentos", "mil e duzentos") para valor numérico. */
function wordsToNumber(text: string): number | null {
  const tokens = text.split(/\s+/).filter((t) => t && t !== "e");
  let total = 0;
  let current = 0;
  let matched = false;
  for (const tok of tokens) {
    if (tok === "mil") {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
      matched = true;
    } else if (tok in HUNDREDS) {
      current += HUNDREDS[tok];
      matched = true;
    } else if (tok in TENS) {
      current += TENS[tok];
      matched = true;
    } else if (tok in UNITS) {
      current += UNITS[tok];
      matched = true;
    }
  }
  total += current;
  return matched ? total : null;
}

function extractAmount(normalized: string): number | null {
  const digitMatch = normalized.match(/r?\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais|real)?/);
  if (digitMatch && /\d/.test(digitMatch[1])) {
    const num = parseFloat(digitMatch[1].replace(/\./g, "").replace(",", "."));
    if (!isNaN(num)) return num;
  }
  const reaisIdx = normalized.search(/\breais?\b/);
  if (reaisIdx > -1) {
    const before = normalized.slice(0, reaisIdx).trim();
    const words = before.split(/\s+/).slice(-6).join(" ");
    const fromWords = wordsToNumber(words);
    if (fromWords !== null) return fromWords;
  }
  return null;
}

function extractEntryCategory(normalized: string): VoiceEntryCategory {
  if (/\b(recebi|ganhei|caiu|entrou)\b/.test(normalized)) return "INCOME";
  if (/\b(investi|apliquei|aportei)\b/.test(normalized)) return "INVESTMENT_CONTRIBUTION";
  return "EXPENSE";
}

function includesWord(normalized: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(normalized);
}

function findMatchedKeyword(normalized: string): { parentCategory: ParentCategory; keyword: string } | null {
  for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ParentCategory, string[]][]) {
    const keyword = keywords.find((kw) => includesWord(normalized, kw));
    if (keyword) return { parentCategory: key, keyword };
  }
  return null;
}

/**
 * Extrai tipo, categoria-mãe, valor e descrição de uma frase falada em português — só regras
 * de palavra-chave e parsing de número por extenso, sem IA, sem custo por uso. Campos não
 * identificados voltam `null`/genéricos para o usuário revisar antes de salvar.
 */
export function parseVoiceEntry(text: string): ParsedVoiceEntry {
  const normalized = normalize(text);
  const match = findMatchedKeyword(normalized);

  return {
    category: extractEntryCategory(normalized),
    parentCategory: match?.parentCategory ?? null,
    amount: extractAmount(normalized),
    description: match ? match.keyword.charAt(0).toUpperCase() + match.keyword.slice(1) : text.trim().slice(0, 60),
  };
}
