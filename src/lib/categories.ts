import type { ParentCategory, ProfileKind } from "@prisma/client";
import { CATEGORIAS_EMPRESA, RECEITAS_EMPRESA, RETENCOES_EMPRESA, ehEmpresa } from "@/lib/profiles/empresa";
import {
  Home,
  UtensilsCrossed,
  Car,
  HeartPulse,
  PartyPopper,
  BookOpen,
  Landmark,
  Shapes,
  Plane,
  Gift,
  PawPrint,
  Dumbbell,
  Coffee,
  ShoppingBag,
  Wrench,
  Gamepad2,
  Tag,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export const PARENT_CATEGORIES: ParentCategory[] = [
  "MORADIA",
  "ALIMENTACAO",
  "TRANSPORTE",
  "SAUDE",
  "LAZER",
  "EDUCACAO",
  "IMPOSTOS",
  "OUTROS",
];

export const PARENT_CATEGORY_LABEL: Record<ParentCategory, string> = {
  MORADIA: "Moradia",
  ALIMENTACAO: "Alimentação",
  TRANSPORTE: "Transporte",
  SAUDE: "Saúde",
  LAZER: "Lazer",
  EDUCACAO: "Educação",
  IMPOSTOS: "Impostos",
  OUTROS: "Outros",
};

/** Descrição de uma linha por categoria, usada nos cards de planejamento em /orcamento. */
export const PARENT_CATEGORY_DESCRIPTION: Record<ParentCategory, string> = {
  MORADIA: "Aluguel, condomínio, contas da casa.",
  ALIMENTACAO: "Supermercado, restaurantes, delivery.",
  TRANSPORTE: "Combustível, aplicativo, transporte público.",
  SAUDE: "Plano de saúde, farmácia, consultas.",
  LAZER: "Streaming, viagens, cinema, hobbies.",
  EDUCACAO: "Mensalidade, cursos, material.",
  IMPOSTOS: "IPTU, IPVA, imposto de renda.",
  OUTROS: "Tarifas, seguros, o que não se encaixa.",
};

/** Ícone por categoria, mesmo espírito de GOAL_ICONS em GoalCard.tsx, só que fixo por categoria. */
export const PARENT_CATEGORY_ICON: Record<ParentCategory, LucideIcon> = {
  MORADIA: Home,
  ALIMENTACAO: UtensilsCrossed,
  TRANSPORTE: Car,
  SAUDE: HeartPulse,
  LAZER: PartyPopper,
  EDUCACAO: BookOpen,
  IMPOSTOS: Landmark,
  OUTROS: Shapes,
};

/** Cor própria por categoria-mãe, usada no círculo translúcido de CategoryIcon.tsx (assinatura
 * visual do documento de referência de design: é O elemento que quebra o monocromático). */
export const PARENT_CATEGORY_COLOR: Record<ParentCategory, string> = {
  MORADIA: "var(--color-cat-moradia)",
  ALIMENTACAO: "var(--color-cat-alimentacao)",
  TRANSPORTE: "var(--color-cat-transporte)",
  SAUDE: "var(--color-cat-saude)",
  LAZER: "var(--color-cat-lazer)",
  EDUCACAO: "var(--color-cat-educacao)",
  IMPOSTOS: "var(--color-cat-impostos)",
  OUTROS: "var(--color-cat-outros)",
};

/** Paleta cíclica pras categorias personalizadas — exclusiva, nunca repete as 7 cores fixas
 * das categorias-mãe (antes usava a mesma lista, e uma categoria nova podia "sortear" a cor
 * exata de Alimentação/Moradia/etc. e ficar indistinguível dela no gráfico). */
const CUSTOM_CATEGORY_PALETTE = [
  "var(--color-custom-1)",
  "var(--color-custom-2)",
  "var(--color-custom-3)",
  "var(--color-custom-4)",
  "var(--color-custom-5)",
  "var(--color-custom-6)",
  "var(--color-custom-7)",
  "var(--color-custom-8)",
  "var(--color-custom-9)",
  "var(--color-custom-10)",
];

export function customCategoryColor(index: number): string {
  return CUSTOM_CATEGORY_PALETTE[index % CUSTOM_CATEGORY_PALETTE.length];
}

/** Cor estável de uma fatia de gasto (categoria-mãe ou personalizada), a MESMA categoria
 * sempre com a MESMA cor, em vez de uma cor por posição no ranking (que mudaria a cada
 * período conforme o que gastou mais). Usada na pizza de "Só gastos". */
export function colorForCategorySlice(category?: { kind: "parent" | "custom"; value: string }, categorias?: CategoriasDoPerfil): string {
  if (!category) return "var(--color-ink-faint)";
  // A cor que ela escolheu (04/10/2026) ganha da de fábrica, nas padrão e nas dela.
  const escolhida = corEscolhida(categorias, category.value);
  if (escolhida) return escolhida;
  if (category.kind === "parent" && isParentCategoryKey(category.value)) {
    return PARENT_CATEGORY_COLOR[category.value];
  }
  // Categoria personalizada: hash simples e estável do id pra sempre cair na mesma cor da paleta.
  let hash = 0;
  for (let i = 0; i < category.value.length; i++) {
    hash = (hash * 31 + category.value.charCodeAt(i)) | 0;
  }
  return customCategoryColor(Math.abs(hash));
}

/** Subcategorias pré-cadastradas por categoria-mãe. "Outro" é sempre oferecido à parte, como texto livre. */
export const SUBCATEGORIES: Record<ParentCategory, string[]> = {
  MORADIA: ["Aluguel", "Condomínio", "IPTU", "Luz", "Água", "Gás", "Internet", "Faxina", "Manutenção"],
  ALIMENTACAO: ["Supermercado", "Restaurante", "Delivery", "Padaria", "Lanche/Café", "Bar"],
  TRANSPORTE: ["Combustível", "Transporte público", "Aplicativo", "Manutenção do veículo", "Estacionamento", "Pedágio"],
  SAUDE: ["Plano de saúde", "Farmácia", "Consultas", "Exames", "Terapia", "Academia"],
  LAZER: ["Streaming", "Viagens", "Cinema/Shows", "Bar/Balada", "Passeios", "Presentes", "Hobbies"],
  EDUCACAO: ["Mensalidade", "Escola", "Cursos", "Livros/Material"],
  IMPOSTOS: ["IPTU", "IPVA", "Imposto de renda", "DARF", "Taxas públicas"],
  OUTROS: ["Tarifas bancárias", "Juros/Empréstimos", "Seguros", "Doações", "Presentes", "Imprevistos"],
};

/** Tipos de renda e de aporte, como chips, pelo mesmo motivo dos gastos: escolher é mais rápido que digitar. */
export const INCOME_TYPES = ["Salário", "Renda extra", "Freela", "Pró-labore", "Dividendos", "Aluguel recebido", "13º", "Restituição", "Presente"];
export const INVESTMENT_TYPES = ["Reserva de emergência", "Tesouro Direto", "CDB", "Ações", "FIIs", "Fundos", "Previdência", "Cripto"];

export const OUTRO_SUBCATEGORY_LABEL = "Outro";

/**
 * Ícones disponíveis pra categorias personalizadas (o usuário escolhe uma dessas ao criar).
 * Guardamos só a `key` no banco (`CustomCategory.icon`) e resolvemos pro componente de ícone
 * aqui, dentro do client component que renderiza, nunca passamos o componente em si como
 * prop de Server pra Client (mesmo cuidado de `PARENT_CATEGORY_ICON`/`BudgetCategoryCard`).
 */
export const CUSTOM_CATEGORY_ICON_OPTIONS: { key: string; icon: LucideIcon; label: string }[] = [
  { key: "plane", icon: Plane, label: "Viagem" },
  { key: "gift", icon: Gift, label: "Presente" },
  { key: "paw", icon: PawPrint, label: "Pet" },
  { key: "dumbbell", icon: Dumbbell, label: "Esporte" },
  { key: "coffee", icon: Coffee, label: "Café" },
  { key: "shopping-bag", icon: ShoppingBag, label: "Compras" },
  { key: "wrench", icon: Wrench, label: "Manutenção" },
  { key: "gamepad", icon: Gamepad2, label: "Jogos" },
  { key: "tag", icon: Tag, label: "Geral" },
  { key: "sparkles", icon: Sparkles, label: "Outro" },
];

export const CUSTOM_CATEGORY_ICON_KEYS = CUSTOM_CATEGORY_ICON_OPTIONS.map((o) => o.key);

export const DEFAULT_CUSTOM_CATEGORY_ICON_KEY = "tag";

export const CUSTOM_CATEGORY_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  CUSTOM_CATEGORY_ICON_OPTIONS.map((o) => [o.key, o.icon]),
);

/** true se `key` for um dos 7 valores fixos de ParentCategory (em vez do id de uma CustomCategory). */
export function isParentCategoryKey(key: string): key is ParentCategory {
  return (PARENT_CATEGORIES as string[]).includes(key);
}


// ─── As categorias na cara do PERFIL ───────────────────────────────────────────────────
// As oito chaves do banco são as mesmas em todo perfil; o que muda é o nome, o ícone, a
// descrição e as subcategorias. Num perfil Empresa, MORADIA é "Estrutura" e SAUDE é "Equipe e
// pró-labore" (ver src/lib/profiles/empresa.ts). Toda tela que mostra categoria passa por aqui
// com o tipo do perfil, em vez de ler as constantes fixas de pessoa física.

/**
 * O que a pessoa mudou nas categorias padrão DESTE perfil (01/10/2026): outro nome, outro ícone,
 * ou escondida ("não uso Impostos"). Mora num campo JSON do perfil (FinancialProfile.categorias);
 * a chave gravada nos lançamentos continua a mesma, então renomear nunca mexe no histórico.
 */
export type PreferenciaDeCategoria = { nome?: string; icone?: string; oculta?: boolean; cor?: string };
/**
 * `proprias`: a cor das categorias que ELA criou, pelo id (04/10/2026). Nome e ícone delas moram
 * na própria CustomCategory; a cor mora aqui, junto das outras preferências, sem mexer no banco.
 */
export type PreferenciasDeCategoria = Partial<Record<ParentCategory, PreferenciaDeCategoria>> & { proprias?: Record<string, { cor: string }> };

/**
 * As cores que dá pra escolher: as de fábrica das categorias e a paleta das criadas. Só tokens
 * do tema, para a cor escolhida funcionar no claro e no escuro. O que vier fora daqui é ignorado.
 */
export const CORES_DE_CATEGORIA: string[] = [
  "var(--color-cat-moradia)",
  "var(--color-cat-alimentacao)",
  "var(--color-cat-transporte)",
  "var(--color-cat-saude)",
  "var(--color-cat-lazer)",
  "var(--color-cat-educacao)",
  "var(--color-cat-impostos)",
  "var(--color-cat-outros)",
  ...Array.from({ length: 10 }, (_, i) => `var(--color-custom-${i + 1})`),
];

export function corValida(cor: unknown): cor is string {
  return typeof cor === "string" && CORES_DE_CATEGORIA.includes(cor);
}

/** A cor que ela escolheu para uma categoria (padrão pela chave, criada pelo id), ou null. */
export function corEscolhida(categorias: CategoriasDoPerfil, chave: string): string | null {
  if (categorias === null || typeof categorias !== "object" || !categorias.prefs) return null;
  const prefs = categorias.prefs;
  const cor = isParentCategoryKey(chave) ? prefs[chave]?.cor : prefs.proprias?.[chave]?.cor;
  return corValida(cor) ? cor : null;
}

/**
 * Quem pergunta o nome de uma categoria: só o tipo do perfil (como sempre foi) ou o tipo com as
 * preferências dele. As telas passam o objeto (ctx.categorias, useProfileTheme().categorias);
 * quem só tem o tipo continua funcionando, com os nomes padrão.
 */
export type CategoriasDoPerfil = ProfileKind | string | null | undefined | { kind: ProfileKind | string; prefs?: PreferenciasDeCategoria | null };

function kindDe(c: CategoriasDoPerfil): ProfileKind | string | null | undefined {
  return c !== null && typeof c === "object" ? c.kind : c;
}
function prefDe(c: CategoriasDoPerfil, key: ParentCategory): PreferenciaDeCategoria | undefined {
  return c !== null && typeof c === "object" ? c.prefs?.[key] : undefined;
}

/** Lê o JSON do banco sem confiar nele: só as 8 chaves, nome curto, ícone conhecido. */
export function lerPreferenciasDeCategoria(json: unknown): PreferenciasDeCategoria {
  if (!json || typeof json !== "object") return {};
  const saida: PreferenciasDeCategoria = {};
  for (const key of PARENT_CATEGORIES) {
    const v = (json as Record<string, unknown>)[key];
    if (!v || typeof v !== "object") continue;
    const { nome, icone, oculta, cor } = v as Record<string, unknown>;
    const pref: PreferenciaDeCategoria = {};
    if (typeof nome === "string" && nome.trim()) pref.nome = nome.trim().slice(0, 40);
    if (typeof icone === "string" && CUSTOM_CATEGORY_ICON_MAP[icone]) pref.icone = icone;
    if (oculta === true) pref.oculta = true;
    if (corValida(cor)) pref.cor = cor;
    if (Object.keys(pref).length > 0) saida[key] = pref;
  }
  const proprias = (json as Record<string, unknown>).proprias;
  if (proprias && typeof proprias === "object") {
    const cores: Record<string, { cor: string }> = {};
    for (const [id, v] of Object.entries(proprias as Record<string, unknown>)) {
      const cor = v && typeof v === "object" ? (v as Record<string, unknown>).cor : undefined;
      if (id.length <= 60 && corValida(cor)) cores[id] = { cor };
    }
    if (Object.keys(cores).length > 0) saida.proprias = cores;
  }
  return saida;
}

export function categoryLabel(categorias: CategoriasDoPerfil, key: ParentCategory): string {
  const nome = prefDe(categorias, key)?.nome;
  if (nome) return nome;
  return ehEmpresa(kindDe(categorias)) ? CATEGORIAS_EMPRESA[key].label : PARENT_CATEGORY_LABEL[key];
}

/** O nome de fábrica, sem a troca dela: é o que a tela de categorias mostra como "era". */
export function categoryDefaultLabel(categorias: CategoriasDoPerfil, key: ParentCategory): string {
  return ehEmpresa(kindDe(categorias)) ? CATEGORIAS_EMPRESA[key].label : PARENT_CATEGORY_LABEL[key];
}

export function categoryDescription(categorias: CategoriasDoPerfil, key: ParentCategory): string {
  return ehEmpresa(kindDe(categorias)) ? CATEGORIAS_EMPRESA[key].descricao : PARENT_CATEGORY_DESCRIPTION[key];
}

export function categoryIcon(categorias: CategoriasDoPerfil, key: ParentCategory): LucideIcon {
  const icone = prefDe(categorias, key)?.icone;
  if (icone && CUSTOM_CATEGORY_ICON_MAP[icone]) return CUSTOM_CATEGORY_ICON_MAP[icone];
  return ehEmpresa(kindDe(categorias)) ? CATEGORIAS_EMPRESA[key].icone : PARENT_CATEGORY_ICON[key];
}

/** Escondida pela pessoa: sai das escolhas (formulário, orçamento, importação), nunca do histórico. */
export function categoriaOculta(categorias: CategoriasDoPerfil, key: ParentCategory): boolean {
  return prefDe(categorias, key)?.oculta === true;
}

/** As categorias que aparecem pra escolher, na ordem de sempre, sem as que ela escondeu. */
export function categoriasParaEscolher(categorias: CategoriasDoPerfil): ParentCategory[] {
  return PARENT_CATEGORIES.filter((k) => !categoriaOculta(categorias, k));
}

export function subcategoriesFor(categorias: CategoriasDoPerfil, key: ParentCategory): string[] {
  return ehEmpresa(kindDe(categorias)) ? CATEGORIAS_EMPRESA[key].subcategorias : SUBCATEGORIES[key];
}

/** Os chips de tipo de entrada: "Salário, Freela…" pra pessoa, "Vendas, Serviços…" pra empresa. */
export function incomeTypesFor(kind: CategoriasDoPerfil): string[] {
  return ehEmpresa(kindDe(kind)) ? RECEITAS_EMPRESA : INCOME_TYPES;
}

/** Os chips de tipo de aporte: "Reserva de emergência, CDB…" pra pessoa, "Reserva de caixa, Reinvestimento…" pra empresa. */
export function investmentTypesFor(kind: CategoriasDoPerfil): string[] {
  return ehEmpresa(kindDe(kind)) ? RETENCOES_EMPRESA : INVESTMENT_TYPES;
}

/** Todas as categorias-mãe com rótulo e ícone do perfil, na ordem de sempre. */
export function parentCategoriesFor(kind: CategoriasDoPerfil): { key: ParentCategory; label: string; description: string; icon: LucideIcon }[] {
  return PARENT_CATEGORIES.map((key) => ({ key, label: categoryLabel(kind, key), description: categoryDescription(kind, key), icon: categoryIcon(kind, key) }));
}
