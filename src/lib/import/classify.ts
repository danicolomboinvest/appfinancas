import type { ParentCategory } from "@prisma/client";

/**
 * Classificação automática de transações do extrato (item 3). Duas camadas:
 * 1) Regras aprendidas do usuário (merchant → categoria), que têm prioridade, é o "lembrar
 *    para transações parecidas no futuro" do briefing.
 * 2) Regras embutidas por palavra-chave (iFood → Alimentação, Uber → Transporte...).
 * O que nenhuma das duas cobrir volta `null` e cai na fila de revisão.
 */

export type Classification = { parentCategory: ParentCategory; subcategory?: string };
export type LearnedRule = { pattern: string; parentCategory: ParentCategory; subcategory?: string };

type BuiltinRule = { keywords: string[]; parentCategory: ParentCategory; subcategory?: string };

const BUILTIN_RULES: BuiltinRule[] = [
  // Alimentação
  { keywords: ["ifood", "rappi", "uber eats", "ubereats", "delivery"], parentCategory: "ALIMENTACAO", subcategory: "Delivery" },
  { keywords: ["restaurante", "lanchonete", "bar ", "pizzaria", "hamburgueria", "mcdonald", "burger king", "bk ", "subway", "outback", "cafe", "café", "padaria", "confeitaria"], parentCategory: "ALIMENTACAO", subcategory: "Restaurante" },
  { keywords: ["supermercado", "mercado", "atacadao", "atacadão", "carrefour", "pao de acucar", "pão de açúcar", "assai", "assaí", "hortifruti", "sacolao"], parentCategory: "ALIMENTACAO", subcategory: "Supermercado" },
  // Transporte
  { keywords: ["uber", "99 ", "99app", "99pop", "cabify", "taxi", "táxi"], parentCategory: "TRANSPORTE", subcategory: "Aplicativo" },
  { keywords: ["posto", "shell", "ipiranga", "petrobras", "combustivel", "combustível", "gasolina", "etanol"], parentCategory: "TRANSPORTE", subcategory: "Combustível" },
  { keywords: ["estacionamento", "estapar", "zona azul"], parentCategory: "TRANSPORTE", subcategory: "Estacionamento" },
  { keywords: ["metro", "metrô", "cptm", "bilhete unico", "bilhete único", "sptrans", "onibus", "ônibus", "brt"], parentCategory: "TRANSPORTE", subcategory: "Transporte público" },
  // Saúde
  { keywords: ["farmacia", "farmácia", "drogaria", "drogasil", "raia", "pacheco", "pague menos"], parentCategory: "SAUDE", subcategory: "Farmácia" },
  { keywords: ["unimed", "amil", "bradesco saude", "sulamerica saude", "plano de saude", "hapvida"], parentCategory: "SAUDE", subcategory: "Plano de saúde" },
  { keywords: ["hospital", "clinica", "clínica", "laboratorio", "laboratório", "consultorio", "consultório", "dentista", "exame"], parentCategory: "SAUDE", subcategory: "Consultas" },
  { keywords: ["academia", "smartfit", "smart fit", "gympass", "wellhub"], parentCategory: "SAUDE", subcategory: "Academia" },
  // Lazer
  { keywords: ["netflix", "spotify", "disney", "hbo", "max ", "amazon prime", "prime video", "youtube premium", "deezer", "globoplay", "paramount", "apple tv"], parentCategory: "LAZER", subcategory: "Streaming" },
  { keywords: ["cinema", "cinemark", "ingresso", "teatro", "show", "sympla", "ticket"], parentCategory: "LAZER", subcategory: "Cinema/Shows" },
  { keywords: ["hotel", "airbnb", "booking", "hospedagem", "passagem", "latam", "gol ", "azul ", "cvc"], parentCategory: "LAZER", subcategory: "Viagens" },
  // Moradia
  { keywords: ["aluguel", "imobiliaria", "imobiliária"], parentCategory: "MORADIA", subcategory: "Aluguel" },
  { keywords: ["condominio", "condomínio"], parentCategory: "MORADIA", subcategory: "Condomínio" },
  { keywords: ["enel", "cpfl", "light", "energia", "eletropaulo", "cemig", "copel"], parentCategory: "MORADIA", subcategory: "Luz" },
  { keywords: ["sabesp", "sanepar", "copasa", "aegea", "conta de agua", "conta de água"], parentCategory: "MORADIA", subcategory: "Água" },
  { keywords: ["vivo", "claro", "tim ", "oi ", "net ", "internet", "telefonia"], parentCategory: "MORADIA", subcategory: "Internet" },
  // Educação
  { keywords: ["escola", "faculdade", "universidade", "curso", "udemy", "alura", "mensalidade", "colegio", "colégio"], parentCategory: "EDUCACAO", subcategory: "Mensalidade" },
  { keywords: ["livraria", "amazon", "kindle", "livro"], parentCategory: "EDUCACAO", subcategory: "Livros/Material" },
  // Financeiro
  { keywords: ["tarifa", "anuidade", "iof", "juros", "seguro", "emprestimo", "empréstimo", "imposto", "tributo", "darf"], parentCategory: "FINANCEIRO", subcategory: "Tarifas bancárias" },
];

/**
 * Reduz uma descrição de extrato a uma "chave de comerciante" estável para aprendizado:
 * minúsculo, sem acentos, sem números/datas/pontuação e sem ruído de meio de pagamento.
 * Ex.: "IFOOD *IFD1234 12/05 SAO PAULO" → "ifood".
 */
export function normalizeMerchant(description: string): string {
  return description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(compra|pagamento|debito|credito|cartao|pix|ted|doc|parcela|\d+\/\d+)\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchLearned(normalized: string, userRules: LearnedRule[]): Classification | null {
  for (const rule of userRules) {
    if (rule.pattern && normalized.includes(rule.pattern)) {
      return { parentCategory: rule.parentCategory, subcategory: rule.subcategory };
    }
  }
  return null;
}

function matchBuiltin(descriptionLower: string): Classification | null {
  for (const rule of BUILTIN_RULES) {
    if (rule.keywords.some((k) => descriptionLower.includes(k))) {
      return { parentCategory: rule.parentCategory, subcategory: rule.subcategory };
    }
  }
  return null;
}

/** Classifica uma descrição. Regras aprendidas do usuário vêm primeiro. `null` = revisar. */
export function classify(description: string, userRules: LearnedRule[] = []): Classification | null {
  const normalized = normalizeMerchant(description);
  return matchLearned(normalized, userRules) ?? matchBuiltin(description.toLowerCase());
}
