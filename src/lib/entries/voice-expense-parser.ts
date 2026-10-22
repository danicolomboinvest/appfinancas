import type { ParentCategory } from "@prisma/client";
import type { CurrencyCode } from "@/lib/money";
import { categoriaDaFala, type ContextoDaFala } from "./categoria-da-fala";
import { chaveParaAprender } from "./vocabulario-falado";
import { casalDaFala, type CasalFalado } from "./casal-da-fala";

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
  /**
   * No gasto: a palavra-chave da fala ("racao", "coco bambu") para guardar a correção dela, se ela
   * trocar a categoria sugerida (ver aprender-da-voz.ts). null quando a fala não tem nada específico.
   */
  chaveDaFala?: string | null;
  /** "ontem" ou "anteontem" dito na frase (14/10/2026); null = hoje. */
  quando?: "ontem" | "anteontem" | null;
  /** Casal simples (15/10/2026): de quem é, quem pagou e como divide, quando a frase disse. */
  casal?: CasalFalado | null;
  /** Compra parcelada dita na frase ("em 3 vezes", "3x de 100"), de 2 a 24; o valor é o TOTAL. */
  parcelas?: number | null;
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
  // Chile (20/10/2026): "5 mil pesos chilenos", "CL$ 5.000", "5000 clp". Antes do argentino: "pesos
  // chilenos" não pode cair no "pesos" solto. Quem tem o app em peso chileno e diz só "pesos" fica
  // com o dele (ver extractCurrency).
  { code: "CLP", pattern: /cl\$|\bclp\b|\bpesos? chilen[oa]s?\b/ },
  // Argentina (14/10/2026): "500 pesos", "AR$ 500", "500 pesos argentinos".
  { code: "ARS", pattern: /ar\$|\bpesos?(?: argentinos?)?\b|\bars\b/ },
  { code: "BRL", pattern: /\breais?\b|r\$/ },
];

/** Palavras de dinheiro que ancoram um número ("45 reais", "2 mil euros"). */
const MONEY_WORDS = "reais?|real|contos?|euros?|dolar(?:es)?|libras?|shekels?|sheqels?|shequels?|chekels?|siclos?|nis|pesos?";

function extractCurrency(normalized: string, moedaDoApp?: string | null): CurrencyCode | null {
  const achada = SPOKEN_CURRENCY.find((c) => c.pattern.test(normalized))?.code ?? null;
  // "Pesos" sem dizer de onde: é o peso do app dela. O argentino era o único peso conhecido.
  if (achada === "ARS" && moedaDoApp === "CLP" && !/argentin|ar\$|\bars\b/.test(normalized)) return "CLP";
  return achada;
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

const EH_PALAVRA_DE_VALOR = (t: string) => t === "e" || t === "mil" || t in HUNDREDS || t in TENS || t in UNITS;

/**
 * O valor por extenso logo antes do "reais", com os centavos ditos no meio (20/10/2026): "vinte e
 * três e cinquenta reais" é 23,50 (antes somava tudo e dava R$ 73). Só vale a sequência de números
 * colada no "reais": em "dois pães por quinze reais" o valor é 15, não 17. Os centavos começam
 * quando chega uma dezena ou unidade que não cabe mais no número (depois de "vinte e três", outro
 * "e cinquenta" não compõe).
 */
function reaisPorExtenso(trecho: string): number | null {
  const tokens = trecho.split(/\s+/).filter(Boolean);
  let i = tokens.length;
  while (i > 0 && EH_PALAVRA_DE_VALOR(tokens[i - 1])) i--;
  const colados = tokens.slice(i);
  if (!colados.some((t) => t !== "e")) return null;
  let total = 0;
  let current = 0;
  for (let k = 0; k < colados.length; k++) {
    const tok = colados[k];
    if (tok === "e") continue;
    // "vinte e três" (ou "quinze") já fechou a parte abaixo de cem: o que vier é centavo.
    const resto = current % 100;
    const fechado = (resto >= 10 && resto < 20) || resto % 10 !== 0;
    const comecaCentavos = (tok in TENS && resto > 0) || (tok in UNITS && fechado);
    if (comecaCentavos && total + current > 0) {
      const centavos = wordsToNumber(colados.slice(k).join(" "));
      if (centavos !== null && centavos > 0 && centavos < 100) return total + current + centavos / 100;
      break;
    }
    if (tok === "mil") {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
    } else if (tok in HUNDREDS) current += HUNDREDS[tok];
    else if (tok in TENS) current += TENS[tok];
    else if (tok in UNITS) current += UNITS[tok];
  }
  return total + current;
}

/** "1.250,90" → 1250.9; "1,250.90" → 1250.9; "100.50" → 100.5; "45,9" → 45.9. */
function lerNumeroEscrito(t: string): number {
  if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(t)) return parseFloat(t.replace(/,/g, ""));
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(t)) return parseFloat(t.replace(/\./g, "").replace(",", "."));
  return parseFloat(t.replace(",", "."));
}

/**
 * Os centavos falados depois do real (14/10/2026): "12 reais e 50 centavos", "um real e noventa",
 * "12 reais e 50 na padaria". Antes o valor ficava em 12 e a descrição virava "Centavos na
 * padaria". Sem a palavra "centavos", só vale a dezena no fim da frase ou antes de "no/na/em/com":
 * "30 reais e 2 cafés" e "50 reais e 20 de gorjeta" não viram centavos.
 */
function centavosDepois(resto: string): number {
  // O "reais" é opcional: "75 e 32 centavos" e "18 e 50" também são ditos assim (17/10/2026).
  const m = resto.match(/^\s*(?:(?:reais|real)\s+)?e\s+(\d{1,2}|[a-z]+(?:\s+e\s+[a-z]+)?)\s*(centavos?)?(?=\s|$)(.*)$/);
  if (!m) return 0;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : wordsToNumber(m[1]);
  if (n === null || n <= 0 || n >= 100) return 0;
  if (m[2]) return n / 100;
  const depois = m[3].trim();
  const dezena = /^\d{2}$/.test(m[1]) || m[1].split(/\s+/).some((w) => w in TENS);
  return dezena && (!depois || /^(no|na|nos|nas|num|numa|em|com|pro|pra|para)\b/.test(depois)) ? n / 100 : 0;
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
  // Três jeitos de escrever: "1.250,90" (do Brasil), "1,250.90" (de fora, o reconhecedor em inglês
  // ou o "US$ 1,234.56") e o número curto "45", "45,90", "100.50", "1.5 mil". No curto, ponto ou
  // vírgula com 1 ou 2 casas é sempre a casa decimal: antes o "100.50" virava 10.050 e o "1.5 mil",
  // 15 mil (14/10/2026).
  const re = /(r\$|us\$|\$|€|£|₪)?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,3}(?:,\d{3})+\.\d{1,2}|\d+(?:[.,]\d{1,2})?)\s*(milhoes|milhao|mil|k)?/g;
  const out: { value: number; index: number; hasCurrency: boolean }[] = [];
  // Até onde a frase já foi lida por um número composto ("4 mil e 500"): o "500" não pode
  // virar um candidato sozinho.
  let lidoAte = 0;
  for (const m of normalized.matchAll(re)) {
    if ((m.index ?? 0) < lidoAte) continue;
    const num = lerNumeroEscrito(m[2]);
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
    // "12 reais e 50 centavos", "12 reais e 50 na padaria": os centavos ditos depois do real.
    if (!m[3]) value = Math.round((value + centavosDepois(resto)) * 100) / 100;
    // Só centavos: "99 centavos no app" é R$ 0,99, não R$ 99 (19/10/2026). Não vale para o
    // "e 32 centavos" de "75 e 32 centavos", que já entrou no número de antes.
    const soCentavos =
      !m[1] && !m[3] && /^\d{1,2}$/.test(m[2]) && /^\s*centavos?\b/.test(resto) && !/\be\s*$/.test(normalized.slice(0, m.index ?? 0));
    if (soCentavos) value = num / 100;
    out.push({
      value,
      index: m.index ?? 0,
      hasCurrency:
        Boolean(m[1]) || soCentavos || new RegExp(`^\\s*(milhoes|milhao|mil)?\\s*(?:(?:${MONEY_WORDS})\\b|€|£|₪)`).test(resto),
    });
  }
  return out;
}

function extractAmount(normalized: string): number | null {
  // O app 99 ("paguei no 99 15 reais", "no 99 15") não é o valor quando há outro número.
  const todos = amountCandidates(normalized);
  const ehOApp = (c: { value: number; index: number; hasCurrency: boolean }) =>
    c.value === 99 && !c.hasCurrency && /\b(no|do|o|pelo)\s*$/.test(normalized.slice(0, c.index));
  const candidatos = todos.length > 1 ? todos.filter((c) => !ehOApp(c)) : todos;
  // Quem está encostado no dinheiro ("R$ 45" / "45 reais") ganha de um número solto: em
  // "2 cafés de 15 reais" o valor é 15, não 2.
  const comMoeda = candidatos.find((c) => c.hasCurrency);
  if (comMoeda) return comMoeda.value;
  if (candidatos.length > 0) return candidatos[0].value;

  // Nada em dígito: só tenta por extenso quando a frase ancora num "reais" ou num "mil",
  // senão "comprei UM presente" viraria um real.
  if (new RegExp(`\\b(${MONEY_WORDS}|mil|milhao|milhoes)\\b`).test(normalized)) {
    const reaisIdx = normalized.search(new RegExp(`\\b(${MONEY_WORDS})\\b`));
    const trecho = reaisIdx > -1 ? normalized.slice(0, reaisIdx).trim().split(/\s+/).slice(-8).join(" ") : normalized;
    const fromWords = reaisIdx > -1 ? reaisPorExtenso(trecho) : wordsToNumber(trecho);
    if (fromWords !== null) return Math.round((fromWords + (reaisIdx > -1 ? centavosDepois(normalized.slice(reaisIdx)) : 0)) * 100) / 100;
  }
  // Só centavos por extenso: "noventa centavos" é R$ 0,90.
  const centavosIdx = normalized.search(/\bcentavos?\b/);
  if (centavosIdx > -1) {
    const n = wordsToNumber(normalized.slice(0, centavosIdx).trim().split(/\s+/).slice(-3).join(" "));
    if (n !== null && n > 0 && n < 100) return n / 100;
  }
  const palavras = normalized.split(/\s+/).map((t) => t.replace(/[^a-z]/g, ""));
  const soPorExtenso = valorSoPorExtenso(palavras);
  if (soPorExtenso) {
    const valor = reaisPorExtenso(palavras.slice(soPorExtenso.inicio, soPorExtenso.fim + 1).join(" "));
    if (valor) return Math.round(valor * 100) / 100;
  }
  return null;
}

/**
 * O valor dito só por extenso, sem "reais" (22/10/2026): "uber doze e noventa", "mercado oitenta
 * e sete". Vale a primeira sequência de dois ou mais números ligados por "e"; número solto continua
 * fora ("comprei um presente" não é R$ 1), e "dia vinte e dois" é data. Devolve onde ela está.
 */
function valorSoPorExtenso(palavras: string[]): { inicio: number; fim: number } | null {
  for (let i = 0; i < palavras.length; i++) {
    if (!EH_PALAVRA_DE_VALOR(palavras[i]) || palavras[i] === "e") continue;
    let fim = i;
    while (fim + 1 < palavras.length && EH_PALAVRA_DE_VALOR(palavras[fim + 1])) fim++;
    while (palavras[fim] === "e") fim--;
    const trecho = palavras.slice(i, fim + 1);
    if (trecho.includes("e") && palavras[i - 1] !== "dia" && !/^centavos?$/.test(palavras[fim + 1] ?? "")) return { inicio: i, fim };
    i = fim;
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
  "dos", "das", "em", "pra", "para", "pro", "por", "hoje", "ontem", "anteontem", "agora", "so", "mais", "acabei", "aqui", "tambem", "e",
  "gastei", "gastamos", "gastou", "gasto", "gastar", "paguei", "pagamos", "pagou", "pagar", "comprei", "compramos", "comprou",
  "comprar", "torrei", "desembolsei", "assinei", "foi", "foram", "deu", "recebi", "recebemos", "recebeu", "receber", "ganhei",
  "ganhou", "caiu", "entrou", "vendi", "investi", "investir", "apliquei", "aportei", "guardei", "poupei", "me", "pagaram",
  "valor", "total", "reais", "real",
  // "Fiz o rancho", "botei gás", "troquei o pneu": o que importa vem depois (14/10/2026).
  "fiz", "fizemos", "dei", "demos", "botei", "coloquei", "troquei", "tive", "mandei", "transferi",
]);
/** O que sobra no fim da frase sem sentido ("Posto de", "Uber hoje"). */
const FIM_SEM_SENTIDO = new Set(["de", "do", "da", "no", "na", "com", "em", "e", "por", "pra", "para", "hoje", "ontem", "anteontem", "agora", "reais", "real"]);
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
    // "e 50 centavos", "e noventa" depois do real: também é o valor.
    // Também depois do número sem o "reais": "75 e 32 centavos", "18 e 50" (17/10/2026).
    if ((PALAVRA_DE_DINHEIRO.test(t) || EH_NUMERO.test(t)) && limpos[i + 1] === "e") {
      let j = i + 2;
      while (j < limpos.length && limpos[j] !== "e" && (PALAVRA_DE_NUMERO(limpos[j]) || /^\d{1,2}$/.test(limpos[j]))) j += 1;
      if (limpos[j] === "e" && j + 1 < limpos.length && PALAVRA_DE_NUMERO(limpos[j + 1])) {
        j += 1;
        while (j < limpos.length && PALAVRA_DE_NUMERO(limpos[j])) j += 1;
      }
      if (j > i + 2) {
        const comCentavos = /^centavos?$/.test(limpos[j] ?? "");
        if (comCentavos || j === limpos.length || /^(no|na|nos|nas|num|numa|em|com|pro|pra|para)$/.test(limpos[j])) {
          for (let k = i + 1; k < j; k += 1) fora.add(k);
          if (comCentavos) fora.add(j);
        }
      }
    }
    // "99 centavos", "noventa centavos" sem o real antes: o "centavos" também é valor.
    if (/^centavos?$/.test(t) && i > 0 && (EH_NUMERO.test(limpos[i - 1]) || PALAVRA_DE_NUMERO(limpos[i - 1]))) {
      fora.add(i);
      for (let j = i - 1; j >= 0 && (PALAVRA_DE_NUMERO(limpos[j]) || EH_NUMERO.test(limpos[j])); j -= 1) fora.add(j);
    }
    // "pesos argentinos": o "argentinos" só é moeda logo depois de "pesos".
    if (t === "argentinos" && limpos[i - 1]?.startsWith("peso")) fora.add(i);
  });
  // Valor só por extenso, sem número nem moeda na frase: "uber doze e noventa" (ver extractAmount).
  if (!limpos.some((t) => EH_NUMERO.test(t) || PALAVRA_DE_DINHEIRO.test(t) || /^(mil|milhao|milhoes)$/.test(t))) {
    const soPorExtenso = valorSoPorExtenso(limpos);
    if (soPorExtenso) for (let k = soPorExtenso.inicio; k <= soPorExtenso.fim; k++) fora.add(k);
  }
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
 * "Paguei 18 reais no noventa e nove": o reconhecedor escreve o app 99 por extenso. Depois de
 * "no/do/o/pelo" e sem moeda logo em seguida, é o app, não o valor ("paguei noventa e nove reais"
 * continua sendo R$ 99).
 */
function noventaENoveEhOApp(text: string): string {
  return text.replace(
    new RegExp(`\\b(no|do|o|pelo)\\s+noventa\\s+e\\s+nove\\b(?!\\s*(${MONEY_WORDS}|mil)\\b)`, "gi"),
    "$1 99",
  );
}

const NUMERO_DA_PARCELA = "(\\d{1,2}|[a-zà-ú]+(?:\\s+e\\s+[a-zà-ú]+)?)";

function numeroDaParcela(t: string): number | null {
  const n = /^\d+$/.test(t) ? Number(t) : wordsToNumber(normalize(t));
  return n !== null && n >= 2 && n <= 24 ? n : null;
}

/**
 * Compra parcelada falada (19/10/2026, pedido da Dani): "parcelei um sapato de 100 reais em três
 * vezes", "geladeira de 3.000 em 10x", "3x de 100 na loja", "12 parcelas de 150". Tira o trecho da
 * frase (senão o "3" virava o valor e a descrição "3x de na loja") e diz se o valor falado é o
 * total ("em 3 vezes") ou de cada parcela ("3x de 100"). O Digitar abre parcelado e ela revisa.
 */
function parcelasDaFala(text: string): { parcelas: number | null; porParcela: boolean; texto: string } {
  // "3x de 100", "12 parcelas de 150": o valor que vem depois é o de cada parcela.
  const porParcela = text.match(new RegExp(`(?:^|\\s)${NUMERO_DA_PARCELA}\\s*(?:x|vezes|parcelas)\\s+de(?=\\s)`, "i"));
  if (porParcela) {
    const n = numeroDaParcela(porParcela[1]);
    if (n) return { parcelas: n, porParcela: true, texto: limparParcela(text.replace(porParcela[0], " ")) };
  }
  // "em 3 vezes", "em 10x", "parcelado em 4", "parcelei em 3 vezes": o valor falado é o total.
  const noTotal = text.match(new RegExp(`(?:^|\\s)(?:parcel(?:ei|ou|amos|ad[oa]s?)\\s+)?em\\s+${NUMERO_DA_PARCELA}\\s*(x|vezes|parcelas)?(?=\\s|$|[,.!?])`, "i"));
  if (noTotal && (noTotal[2] || /parcel/i.test(noTotal[0]))) {
    const n = numeroDaParcela(noTotal[1]);
    if (n) return { parcelas: n, porParcela: false, texto: limparParcela(text.replace(noTotal[0], " ")) };
  }
  return { parcelas: null, porParcela: false, texto: text };
}

/** O que sobra da parcela na frase: "parcelei", "parcelado", "sem juros" e "uma compra de um". */
function limparParcela(text: string): string {
  return text
    .replace(/\b(parcel(?:ei|ou|amos|ad[oa]s?)|sem juros)\b/gi, " ")
    .replace(/(^|\s)(?:uma\s+)?compra\s+(?:de|do|da)\s+(?:uma?\s+)?/i, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `contexto`: as regras que ELA ensinou e as categorias que ela criou (quem chama no servidor
 * passa; sem contexto, só o dicionário, a base comunitária e as palavras faladas).
 */
export function parseVoiceEntry(falado: string, contexto: ContextoDaFala = {}, casa: { nomeDoPar?: string | null } = {}): ParsedVoiceEntry {
  const parcela = parcelasDaFala(noventaENoveEhOApp(falado));
  const text = parcela.texto;
  const normalized = normalize(text);
  const category = extractEntryCategory(normalized);
  // Casal simples: "Lucas pagou", "metade cada", "da casa" preenchem as perguntas do casal e saem
  // da descrição (só no gasto e só dentro de uma casa).
  const doCasal = category === "EXPENSE" && casa.nomeDoPar ? casalDaFala(text, casa.nomeDoPar) : { casal: null, texto: text };
  const limpa = descricaoDaFala(doCasal.texto);
  // "Gastei 45 no mercado ontem" era gravado com a data de hoje (14/10/2026).
  const quando = /\banteontem\b/.test(normalized) ? ("anteontem" as const) : /\bontem\b/.test(normalized) ? ("ontem" as const) : null;
  const base = { category, amount: extractAmount(normalized), currency: extractCurrency(normalized, contexto.moedaDoApp), quando };

  if (category === "EXPENSE") {
    // "3x de 100": o valor falado é o da parcela; o Digitar recebe sempre o total.
    if (parcela.parcelas && parcela.porParcela && base.amount !== null) base.amount = Math.round(base.amount * parcela.parcelas * 100) / 100;
    // O mesmo motor da importação (14/10/2026): "posto" é Combustível lá, e tem que ser aqui.
    // Frase só com verbo e valor ("gastei 300 reais"): não há o que categorizar, e não chuta.
    const achada = limpa ? categoriaDaFala(limpa, contexto) : null;
    return {
      ...base,
      parentCategory: achada?.customCategoryId ? null : (achada?.parentCategory ?? null),
      subcategory: achada?.customCategoryId ? null : (achada?.subcategory ?? null),
      customCategoryId: achada?.customCategoryId ?? null,
      description: limpa,
      chaveDaFala: limpa ? chaveParaAprender(limpa) : null,
      ...(doCasal.casal ? { casal: doCasal.casal } : {}),
      ...(parcela.parcelas ? { parcelas: parcela.parcelas } : {}),
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
