import type { ParentCategory } from "@prisma/client";

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
