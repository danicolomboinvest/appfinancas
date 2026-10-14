import type { ParentCategory } from "@prisma/client";
import type { CurrencyCode } from "@/lib/money";
import { categoriaDaFala, type ContextoDaFala } from "./categoria-da-fala";

export type VoiceEntryCategory = "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";

export type ParsedVoiceEntry = {
  category: VoiceEntryCategory;
  parentCategory: ParentCategory | null;
  /** A subcategoria que o motor achou ("Combustível", "Delivery"), quando achou. */
  subcategory?: string | null;
  /** A categoria que ELA criou, quando é essa a resposta (manda sobre a `parentCategory`). */
  customCategoryId?: string | null;
  amount: number | null;
  description: string;
  /** Moeda dita na frase ("2 mil euros"); null quando a pessoa não disse nenhuma. */
  currency: CurrencyCode | null;
};

/**
 * As moedas como se fala: "euros", "dólares", "libras", "reais" (já sem acento, ver `normalize`).
 * E como o reconhecedor de voz escreve: em pt-BR ele costuma formatar "50 dólares" como
 * "US$ 50" e "2 mil euros" como "€ 2.000" — sem o símbolo aqui, o valor era lido mas a moeda
 * não, e o gasto em dólar era gravado como se fosse em real.
 */
const SPOKEN_CURRENCY: { code: CurrencyCode; pattern: RegExp }[] = [
  { code: "EUR", pattern: /€|\beuros?\b/ },
  // "us$" antes do real: não contém "r$", mas o "$" solto não pode decidir nada sozinho.
  { code: "USD", pattern: /us\$|\bdolar(?:es)?\b/ },
  { code: "GBP", pattern: /£|\blibras?\b/ },
  // Quem mora em Israel (12/10/2026): "50 shekels", "₪ 50", "50 sheqel", "50 nis".
  { code: "ILS", pattern: /₪|\b(?:shekels?|sheqels?|shequels?|chekels?|siclos?|nis|ils)\b/ },
  // Argentina (14/10/2026): "500 pesos", "AR$ 500", "500 pesos argentinos".
  { code: "ARS", pattern: /ar\$|\bpesos?(?: argentinos?)?\b|\bars\b/ },
  { code: "BRL", pattern: /\breais?\b|r\$/ },
];

/** Palavras de dinheiro que ancoram um número ("45 reais", "2 mil euros"). */
const MONEY_WORDS = "reais?|contos?|euros?|dolar(?:es)?|libras?|shekels?|sheqels?|shequels?|chekels?|siclos?|nis|pesos?";

function extractCurrency(normalized: string): CurrencyCode | null {
  return SPOKEN_CURRENCY.find((c) => c.pattern.test(normalized))?.code ?? null;
}

/**
 * Palavras-chave faladas por categoria. Desde 14/10/2026 o GASTO é categorizado pelo mesmo motor
 * da importação (categoria-da-fala.ts); esta lista ficou para o aporte ("investi em cdb") e para a
 * descrição curta da renda e do aporte. Comparado sempre sem acento (ver `normalize`).
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
  IMPOSTOS: ["imposto", "iptu", "ipva", "darf", "tributo"],
  OUTROS: ["poupanca", "cdb", "tesouro", "acoes", "investimento", "seguro", "tarifa"],
};

/**
 * Substantivos que, sozinhos, já dizem que o dinheiro entrou. Vêm depois dos verbos na frase
 * típica ("paguei o salário da diarista"), e é justamente por isso que a regra do primeiro a
 * aparecer resolve: ali o "paguei" vem antes e o lançamento continua sendo gasto.
 */
const INCOME_NOUNS =
  /\b(salario|freela|freelance|pro\s?labore|comissao|bonus|decimo\s+terceiro|restituicao|rendimentos?|dividendos?|pensao|adiantamento)\b/;

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

const SCALE: Record<string, number> = { mil: 1000, milhao: 1_000_000, milhoes: 1_000_000, k: 1000 };

/**
 * Cada número dito na frase, já com a escala aplicada.
 *
 * O "mil" solto era o buraco: "recebi 4 mil reais" casava com o 4 e registrava quatro reais —
 * um erro de mil vezes, calado, num campo que a pessoa raramente confere. Ninguém fala "quatro
 * mil e quinhentos" só por extenso nem só em dígito, então a cauda por extenso ("4 mil e
 * quinhentos") entra junto.
 */
function amountCandidates(normalized: string): { value: number; index: number; hasCurrency: boolean }[] {
  const re = /(r\$|us\$|\$|€|£|₪)?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(milhoes|milhao|mil|k)?/g;
  const out: { value: number; index: number; hasCurrency: boolean }[] = [];
  // Até onde a frase já foi lida por um número composto ("4 mil e 500"): o "500" não pode
  // virar um candidato sozinho.
  let lidoAte = 0;
  for (const m of normalized.matchAll(re)) {
    if ((m.index ?? 0) < lidoAte) continue;
    const num = parseFloat(m[2].replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) continue;
    const scale = m[3] ? SCALE[m[3]] : 1;
    let value = num * scale;
    let resto = normalized.slice((m.index ?? 0) + m[0].length);
    if (m[3] === "mil") {
      // "4 mil e quinhentos": a sobra só vale se for menor que a escala, senão vira outro número.
      const tail = resto.match(new RegExp(`^\\s*e\\s+([a-z\\s]{1,30}?)(?=\\s*(${MONEY_WORDS}|$))`))?.[1];
      const extra = tail ? wordsToNumber(tail) : null;
      if (extra !== null && extra < 1000) value += extra;
      // "4 mil e 500 reais": o reconhecedor de voz escreve a sobra em dígito. Sem isto o "500"
      // (encostado no "reais") ganhava do "4 mil" e o salário entrava nove vezes menor.
      const emDigito = resto.match(/^\s*e\s+(\d{1,3})(?![\d]|[.,]\d)/);
      if (extra === null && emDigito) {
        value += Number(emDigito[1]);
        resto = resto.slice(emDigito[0].length);
        lidoAte = (m.index ?? 0) + m[0].length + emDigito[0].length;
      }
    }
    out.push({
      value,
      index: m.index ?? 0,
      hasCurrency:
        Boolean(m[1]) || new RegExp(`^\\s*(milhoes|milhao|mil)?\\s*(?:(?:${MONEY_WORDS})\\b|€|£|₪)`).test(resto),
    });
  }
  return out;
}

function extractAmount(normalized: string): number | null {
  const candidatos = amountCandidates(normalized);
  // Quem está encostado no dinheiro ("R$ 45" / "45 reais") ganha de um número solto: em
  // "2 cafés de 15 reais" o valor é 15, não 2.
  const comMoeda = candidatos.find((c) => c.hasCurrency);
  if (comMoeda) return comMoeda.value;
  if (candidatos.length > 0) return candidatos[0].value;

  // Nada em dígito: só tenta por extenso quando a frase ancora num "reais" ou num "mil",
  // senão "comprei UM presente" viraria um real.
  if (new RegExp(`\\b(${MONEY_WORDS}|mil|milhao|milhoes)\\b`).test(normalized)) {
    const reaisIdx = normalized.search(new RegExp(`\\b(${MONEY_WORDS})\\b`));
    const trecho = reaisIdx > -1 ? normalized.slice(0, reaisIdx).trim().split(/\s+/).slice(-6).join(" ") : normalized;
    const fromWords = wordsToNumber(trecho);
    if (fromWords !== null) return fromWords;
  }
  return null;
}

/**
 * Como a frase falada vira um TIPO de lançamento.
 *
 * Errar aqui é o erro mais caro que este arquivo pode cometer: troca o sinal do dinheiro e
 * estraga a conta do mês inteiro. Antes a lista tinha quatro verbos, todos no passado, então
 * "acabei de receber 4 mil" virava gasto — ninguém fala só no pretérito perfeito.
 *
 * Vence quem aparece PRIMEIRO na frase, não quem está primeiro na lista. Em "recebi o salário
 * e paguei o aluguel" quem manda é o "recebi"; em "me pagaram 500" o "me pagaram" começa antes
 * do "pagaram" e por isso ganha dele.
 */
const TYPE_RULES: { kind: VoiceEntryCategory; pattern: RegExp }[] = [
  // Dinheiro que ENTRA.
  { kind: "INCOME", pattern: /\b(receb(?:i|e|eu|er|emos|eram|endo|ido)|ganh(?:ei|ou|ar|amos|aram)|fatur(?:ei|ou|ar|amos))\b/ },
  { kind: "INCOME", pattern: /\b(caiu|cairam|pingou|entrou|entraram|creditou|creditaram|depositaram|depositou)\b/ },
  { kind: "INCOME", pattern: /\bme\s+(pagaram|pagou|devolveram|devolveu|reembolsaram|transferiram|transferiu)\b/ },
  { kind: "INCOME", pattern: /\bvend(?:i|eu|emos|eram)\b/ },
  { kind: "INCOME", pattern: INCOME_NOUNS },

  // Dinheiro que vai pra INVESTIMENTO.
  {
    kind: "INVESTMENT_CONTRIBUTION",
    pattern: /\b(invest(?:i|iu|ir|imos|iram)|apliquei|aplic(?:ou|ar|amos|aram)|aport(?:ei|ou|ar|amos|aram)|guard(?:ei|ou|ar|amos)|poup(?:ei|ou|ar|amos))\b/,
  },
  // "Comprei" sozinho é gasto; perto de ativo, é aporte.
  {
    kind: "INVESTMENT_CONTRIBUTION",
    pattern: /\bcompr(?:ei|ou|ar|amos|aram)\b(?=.{0,40}\b(acoes?|fiis?|tesouro|cdb|lci|lca|bitcoin|cripto)\b)/,
  },

  // Dinheiro que SAI.
  {
    kind: "EXPENSE",
    pattern: /\b(gast(?:ei|ou|ar|amos|ando)|pag(?:uei|ou|ar|amos|aram)|compr(?:ei|ou|ar|amos|aram)|torrei|desembolsei|assinei)\b/,
  },
];

function extractEntryCategory(normalized: string): VoiceEntryCategory {
  let melhor: { kind: VoiceEntryCategory; index: number } | null = null;
  for (const rule of TYPE_RULES) {
    const found = normalized.match(rule.pattern);
    if (found?.index === undefined) continue;
    if (melhor === null || found.index < melhor.index) melhor = { kind: rule.kind, index: found.index };
  }
  // Sem nenhum verbo reconhecido, gasto: é o que a pessoa registra o dia inteiro.
  return melhor?.kind ?? "EXPENSE";
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
 * Extrai tipo, categoria-mãe, valor e descrição de uma frase falada em português, só regras
 * de palavra-chave e parsing de número por extenso, sem IA, sem custo por uso. Campos não
 * identificados voltam `null`/genéricos para o usuário revisar antes de salvar.
 */
/**
 * A palavra reconhecida volta sem acento, porque é assim que ela é comparada. Escrever
 * "Salario" ou "Farmacia" na descrição do lançamento parece erro de digitação da pessoa —
 * aqui ela recupera a grafia certa antes de virar texto na tela.
 */
const DISPLAY_LABEL: Record<string, string> = {
  acoes: "Ações", agua: "Água", almoco: "Almoço", bonus: "Bônus", cdb: "CDB",
  combustivel: "Combustível", comissao: "Comissão", condominio: "Condomínio",
  "decimo terceiro": "Décimo terceiro", farmacia: "Farmácia", gas: "Gás", ifood: "iFood",
  iptu: "IPTU", lci: "LCI", lca: "LCA", medico: "Médico", metro: "Metrô", onibus: "Ônibus",
  pedagio: "Pedágio", pensao: "Pensão", poupanca: "Poupança", "pro labore": "Pró-labore",
  "prolabore": "Pró-labore", remedio: "Remédio", restituicao: "Restituição",
  salario: "Salário", taxi: "Táxi", tres: "Três",
};

function toLabel(word: string): string {
  return DISPLAY_LABEL[word] ?? word.charAt(0).toUpperCase() + word.slice(1);
}

/** Verbos e muletas do começo da frase falada, que não dizem O QUE foi. */
const INICIO_SEM_SENTIDO = new Set([
  "eu", "a", "o", "as", "os", "um", "uma", "uns", "umas", "com", "no", "na", "nos", "nas", "num", "numa", "de", "do", "da",
  "dos", "das", "em", "pra", "para", "pro", "por", "hoje", "ontem", "agora", "so", "mais", "acabei", "aqui", "tambem", "e",
  "gastei", "gastamos", "gastou", "gasto", "gastar", "paguei", "pagamos", "pagou", "pagar", "comprei", "compramos", "comprou",
  "comprar", "torrei", "desembolsei", "assinei", "foi", "foram", "deu", "recebi", "recebemos", "recebeu", "receber", "ganhei",
  "ganhou", "caiu", "entrou", "vendi", "investi", "investir", "apliquei", "aportei", "guardei", "poupei", "me", "pagaram",
  "valor", "total", "reais", "real",
]);
/** O que sobra no fim da frase sem sentido ("Posto de", "Uber hoje"). */
const FIM_SEM_SENTIDO = new Set(["de", "do", "da", "no", "na", "com", "em", "e", "por", "pra", "para", "hoje", "ontem", "agora", "reais", "real"]);
const PALAVRA_DE_DINHEIRO = new RegExp(`^(${MONEY_WORDS}|real|dolares|dolar|argentinos?)$`);
const PALAVRA_DE_NUMERO = (t: string) => t in UNITS || t in TENS || t in HUNDREDS || t === "mil" || t === "milhao" || t === "milhoes" || t === "e";
const EH_NUMERO = /^(r\$|us\$|ar\$|\$|€|£|₪)?\d[\d.,]*(k|mil)?$|^(r\$|us\$|ar\$|\$|€|£|₪)$/;

/**
 * O essencial do que ela disse, para a descrição: sem "gastei/paguei", sem o valor, sem a moeda,
 * sem o "com/no/de" do começo. "gastei 300 reais com posto" → "Posto"; "paguei 45 no ifood" →
 * "iFood"; "gastei 120 reais no almoço no Coco Bambu" → "Almoço no Coco Bambu". Mantém a grafia
 * que o reconhecedor de voz escreveu (o nome próprio já vem com maiúscula) e põe maiúscula só na
 * primeira letra. Vazio quando a frase era só verbo e valor ("gastei 300 reais").
 */
export function descricaoDaFala(text: string): string {
  const crus = text.trim().split(/\s+/).filter(Boolean);
  const limpos = crus.map((t) => normalize(t).replace(/^[^a-z0-9$€£₪]+|[^a-z0-9$€£₪]+$/g, ""));
  const fora = new Set<number>();
  limpos.forEach((t, i) => {
    if (!t) fora.add(i);
    // O app "99" ("paguei 15 no 99") é nome, não valor.
    else if (EH_NUMERO.test(t) && !(t === "99" && /^(no|do|o)$/.test(limpos[i - 1] ?? ""))) fora.add(i);
    else if (PALAVRA_DE_DINHEIRO.test(t)) {
      fora.add(i);
      // O valor por extenso antes da moeda: "quinhentos reais", "dois mil e duzentos euros".
      for (let j = i - 1; j >= 0 && (PALAVRA_DE_NUMERO(limpos[j]) || EH_NUMERO.test(limpos[j])); j -= 1) fora.add(j);
    } else if (/^(mil|milhao|milhoes)$/.test(t)) {
      fora.add(i);
      for (let j = i - 1; j >= 0 && (PALAVRA_DE_NUMERO(limpos[j]) || EH_NUMERO.test(limpos[j])); j -= 1) fora.add(j);
      // "4 mil e quinhentos": a cauda por extenso também é valor.
      for (let j = i + 1; j < limpos.length && PALAVRA_DE_NUMERO(limpos[j]); j += 1) fora.add(j);
    }
    // "pesos argentinos": o "argentinos" só é moeda logo depois de "pesos".
    if (t === "argentinos" && limpos[i - 1]?.startsWith("peso")) fora.add(i);
  });
  let palavras = crus.map((c, i) => ({ c: c.replace(/[,;:.!?]+$/, ""), n: limpos[i] })).filter((_, i) => !fora.has(i));
  while (palavras.length && INICIO_SEM_SENTIDO.has(palavras[0].n)) palavras = palavras.slice(1);
  while (palavras.length && FIM_SEM_SENTIDO.has(palavras[palavras.length - 1].n)) palavras = palavras.slice(0, -1);
  // A grafia certa do que o reconhecedor escreveu sem acento ou sem a caixa da marca ("ifood").
  const grafada = palavras.map(({ c, n }) => (DISPLAY_LABEL[n] && c === c.toLowerCase() && normalize(c) === c ? DISPLAY_LABEL[n] : c));
  if (!grafada.length) return "";
  // A primeira com maiúscula, menos a marca que começa minúscula ("iFood").
  const primeira = grafada[0] === DISPLAY_LABEL[palavras[0].n] ? grafada[0] : grafada[0].charAt(0).toUpperCase() + grafada[0].slice(1);
  return [primeira, ...grafada.slice(1)].join(" ").slice(0, 60).trim();
}

/**
 * `contexto`: as regras que ELA ensinou e as categorias que ela criou (quem chama no servidor
 * passa; sem contexto, só o dicionário, a base comunitária e as palavras faladas).
 */
export function parseVoiceEntry(text: string, contexto: ContextoDaFala = {}): ParsedVoiceEntry {
  const normalized = normalize(text);
  const category = extractEntryCategory(normalized);
  const limpa = descricaoDaFala(text);
  const base = { category, amount: extractAmount(normalized), currency: extractCurrency(normalized) };

  if (category === "EXPENSE") {
    // O mesmo motor da importação (14/10/2026): "posto" é Combustível lá, e tem que ser aqui.
    const achada = categoriaDaFala(limpa || text, contexto);
    return {
      ...base,
      parentCategory: achada?.customCategoryId ? null : (achada?.parentCategory ?? null),
      subcategory: achada?.customCategoryId ? null : (achada?.subcategory ?? null),
      customCategoryId: achada?.customCategoryId ?? null,
      description: limpa,
    };
  }

  // Renda e aporte: sem categoria de gasto. A descrição curta ("Salário", "CDB") vira o Tipo.
  const match = findMatchedKeyword(normalized);
  // As categorias-mãe são de GASTO. Em "recebi 4 mil de aluguel" o aluguel é a origem do
  // dinheiro, não um gasto com moradia — marcar a categoria ali só sujaria o orçamento.
  const parentCategory = category === "INCOME" ? null : (match?.parentCategory ?? null);
  const incomeNoun = category === "INCOME" ? normalized.match(INCOME_NOUNS)?.[0] : undefined;
  const label = incomeNoun ?? (parentCategory ? match?.keyword : undefined);
  return { ...base, parentCategory, subcategory: null, customCategoryId: null, description: label ? toLabel(label) : limpa };
}
