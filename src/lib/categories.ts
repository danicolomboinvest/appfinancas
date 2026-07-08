import type { ParentCategory } from "@prisma/client";
import {
  Home,
  UtensilsCrossed,
  Car,
  HeartPulse,
  PartyPopper,
  BookOpen,
  Landmark,
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
  "FINANCEIRO",
];

export const PARENT_CATEGORY_LABEL: Record<ParentCategory, string> = {
  MORADIA: "Moradia",
  ALIMENTACAO: "Alimentação",
  TRANSPORTE: "Transporte",
  SAUDE: "Saúde",
  LAZER: "Lazer",
  EDUCACAO: "Educação",
  FINANCEIRO: "Financeiro",
};

/** Descrição de uma linha por categoria — usada nos cards de planejamento em /orcamento. */
export const PARENT_CATEGORY_DESCRIPTION: Record<ParentCategory, string> = {
  MORADIA: "Aluguel, condomínio, contas da casa.",
  ALIMENTACAO: "Supermercado, restaurantes, delivery.",
  TRANSPORTE: "Combustível, aplicativo, transporte público.",
  SAUDE: "Plano de saúde, farmácia, consultas.",
  LAZER: "Streaming, viagens, cinema, hobbies.",
  EDUCACAO: "Mensalidade, cursos, material.",
  FINANCEIRO: "Tarifas, juros, seguros, impostos.",
};

/** Ícone por categoria — mesmo espírito de GOAL_ICONS em GoalCard.tsx, só que fixo por categoria. */
export const PARENT_CATEGORY_ICON: Record<ParentCategory, LucideIcon> = {
  MORADIA: Home,
  ALIMENTACAO: UtensilsCrossed,
  TRANSPORTE: Car,
  SAUDE: HeartPulse,
  LAZER: PartyPopper,
  EDUCACAO: BookOpen,
  FINANCEIRO: Landmark,
};

/** Subcategorias pré-cadastradas por categoria-mãe. "Outro" é sempre oferecido à parte, como texto livre. */
export const SUBCATEGORIES: Record<ParentCategory, string[]> = {
  MORADIA: ["Aluguel", "Condomínio", "IPTU", "Luz", "Água", "Internet", "Manutenção"],
  ALIMENTACAO: ["Supermercado", "Restaurante", "Delivery", "Padaria"],
  TRANSPORTE: ["Combustível", "Transporte público", "Aplicativo", "Manutenção do veículo", "Estacionamento"],
  SAUDE: ["Plano de saúde", "Farmácia", "Consultas", "Exames", "Academia"],
  LAZER: ["Streaming", "Viagens", "Cinema/Shows", "Hobbies"],
  EDUCACAO: ["Mensalidade", "Cursos", "Livros/Material"],
  FINANCEIRO: ["Tarifas bancárias", "Juros/Empréstimos", "Seguros", "Impostos"],
};

export const OUTRO_SUBCATEGORY_LABEL = "Outro";

/**
 * Ícones disponíveis pra categorias personalizadas (o usuário escolhe uma dessas ao criar).
 * Guardamos só a `key` no banco (`CustomCategory.icon`) e resolvemos pro componente de ícone
 * aqui, dentro do client component que renderiza — nunca passamos o componente em si como
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
