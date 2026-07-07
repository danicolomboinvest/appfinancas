import type { ParentCategory } from "@prisma/client";
import { Home, UtensilsCrossed, Car, HeartPulse, PartyPopper, BookOpen, Landmark, type LucideIcon } from "lucide-react";

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
