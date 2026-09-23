import type { ParentCategory, ProfileKind } from "@prisma/client";
import { Building2, Package, Truck, Users, Megaphone, Handshake, Landmark, Shapes, type LucideIcon } from "lucide-react";

/**
 * O perfil EMPRESA: o app deixa de falar de moradia e lazer e passa a falar de custos,
 * despesas, impostos, pró-labore e lucro. A estrutura do banco é a mesma (as oito
 * categorias-mãe continuam sendo as oito chaves), o que muda é o que cada chave SIGNIFICA
 * numa empresa e como as contas se fecham: em vez de "entrou − gastou = sobrou", uma DRE.
 *
 * O que uma pequena empresa precisa controlar, segundo o Sebrae e a literatura de gestão
 * de MPE (ver o resumo em memória):
 *   1. Fluxo de caixa realizado e projetado — o que já existe no app (o mês).
 *   2. DRE simplificada: receita → impostos → custos variáveis → margem de contribuição →
 *      despesas fixas → lucro operacional.
 *   3. Pró-labore separado do lucro, e o dinheiro da empresa separado do da pessoa.
 *   4. Reserva de caixa (3 a 6 meses de despesas fixas) e capital de giro.
 *   5. Ponto de equilíbrio: quanto precisa faturar pra pagar as contas fixas.
 *   6. Provisão de impostos (DAS do Simples) antes de gastar o que entrou.
 */

export function ehEmpresa(kind: ProfileKind | string | null | undefined): boolean {
  return kind === "EMPRESA";
}

/** O que cada categoria-mãe vira na DRE: custo que varia com a venda, despesa fixa ou imposto. */
export type Natureza = "variavel" | "fixa" | "imposto";

export type CategoriaEmpresa = {
  label: string;
  descricao: string;
  icone: LucideIcon;
  natureza: Natureza;
  subcategorias: string[];
};

/**
 * As oito chaves do banco lidas como plano de contas de uma empresa. A escolha de qual chave
 * vira o quê segue a cor e o ícone que a pessoa já conhece de cada uma (Moradia é o teto, a
 * casa; na empresa, é a estrutura), pra quem tem os dois perfis não se perder.
 */
export const CATEGORIAS_EMPRESA: Record<ParentCategory, CategoriaEmpresa> = {
  MORADIA: {
    label: "Estrutura",
    descricao: "Aluguel, contas, internet, software: o que mantém a porta aberta.",
    icone: Building2,
    natureza: "fixa",
    subcategorias: ["Aluguel", "Condomínio", "Luz", "Água", "Internet/Telefone", "Software e assinaturas", "Manutenção", "Limpeza"],
  },
  ALIMENTACAO: {
    label: "Mercadorias e insumos",
    descricao: "O que você compra pra vender ou pra produzir. Sobe e desce com a venda.",
    icone: Package,
    natureza: "variavel",
    subcategorias: ["Mercadorias pra revenda", "Matéria-prima", "Embalagens", "Fornecedores", "Estoque"],
  },
  TRANSPORTE: {
    label: "Logística e entregas",
    descricao: "Frete, motoboy, combustível, correios.",
    icone: Truck,
    natureza: "variavel",
    subcategorias: ["Frete", "Motoboy/Aplicativo", "Correios", "Combustível", "Viagens a trabalho", "Estacionamento"],
  },
  SAUDE: {
    label: "Equipe e pró-labore",
    descricao: "Seu pró-labore, salários, encargos e quem trabalha com você.",
    icone: Users,
    natureza: "fixa",
    subcategorias: ["Pró-labore", "Salários", "Encargos/INSS", "Benefícios", "Freelancers", "Treinamento"],
  },
  EDUCACAO: {
    label: "Marketing e vendas",
    descricao: "Anúncios, comissões, taxas de cartão e de marketplace.",
    icone: Megaphone,
    natureza: "variavel",
    subcategorias: ["Anúncios", "Comissões", "Taxas de cartão/maquininha", "Marketplace", "Material de divulgação", "Brindes"],
  },
  LAZER: {
    label: "Serviços e terceiros",
    descricao: "Contador, jurídico, design, sistemas, consultoria.",
    icone: Handshake,
    natureza: "fixa",
    subcategorias: ["Contador", "Jurídico", "Design", "Consultoria", "Sistemas", "Segurança"],
  },
  IMPOSTOS: {
    label: "Impostos e taxas",
    descricao: "DAS do Simples, ISS, alvará, taxas bancárias.",
    icone: Landmark,
    natureza: "imposto",
    subcategorias: ["DAS (Simples Nacional)", "ISS", "ICMS", "Alvará e licenças", "Taxas bancárias", "Multas e juros"],
  },
  OUTROS: {
    label: "Outros",
    descricao: "Seguros, empréstimos, imprevistos: o que não se encaixa acima.",
    icone: Shapes,
    natureza: "fixa",
    subcategorias: ["Seguros", "Empréstimos", "Equipamentos", "Imprevistos", "Doações"],
  },
};

/** Tipos de entrada de uma empresa, como chips na hora de registrar. */
export const RECEITAS_EMPRESA = ["Vendas", "Serviços", "Assinaturas", "Comissões recebidas", "Rendimento do caixa", "Outras receitas"];
/** Pra onde uma empresa guarda o que retém: reserva de caixa primeiro, depois reinvestir. */
export const RETENCOES_EMPRESA = ["Reserva de caixa", "Reinvestimento", "Tesouro/CDB", "Equipamentos", "Provisão de impostos"];

/** Natureza de uma categoria qualquer na DRE. Categoria personalizada entra como despesa fixa. */
export function naturezaDaCategoria(parent: ParentCategory | null | undefined): Natureza {
  return parent ? CATEGORIAS_EMPRESA[parent].natureza : "fixa";
}

// ─── DRE ─────────────────────────────────────────────────────────────────────────────────

export type EntradaDRE = {
  /** Tudo que entrou no período (receita bruta). */
  receita: number;
  /** Gasto por categoria-mãe. */
  gastoPorCategoria: Partial<Record<ParentCategory, number>>;
  /** Gasto em categorias personalizadas (entram como despesa fixa). */
  gastoPersonalizado?: number;
  /** O que a empresa reteve: reserva de caixa, reinvestimento (os "aportes" do app). */
  retido?: number;
};

export type DRE = {
  receitaBruta: number;
  impostos: number;
  receitaLiquida: number;
  custosVariaveis: number;
  margemContribuicao: number;
  /** Margem de contribuição sobre a receita bruta, 0–1. `null` sem receita. */
  margemContribuicaoPct: number | null;
  despesasFixas: number;
  lucroOperacional: number;
  /** Lucro operacional sobre a receita bruta, 0–1. `null` sem receita. */
  margemLiquidaPct: number | null;
  retido: number;
  /** O que ficou no caixa depois de reter. */
  sobraNoCaixa: number;
  /**
   * Quanto precisa faturar no mês pra pagar impostos, custos e despesas fixas e ficar no
   * zero. `null` quando a margem de contribuição não é positiva (não existe faturamento que
   * cubra: cada venda perde dinheiro) ou quando ainda não há receita pra medir a margem.
   */
  pontoDeEquilibrio: number | null;
};

export function calcularDRE(e: EntradaDRE): DRE {
  const receitaBruta = Math.max(0, e.receita);
  let impostos = 0;
  let custosVariaveis = 0;
  let despesasFixas = e.gastoPersonalizado ?? 0;
  for (const c of Object.keys(CATEGORIAS_EMPRESA) as ParentCategory[]) {
    const v = e.gastoPorCategoria[c] ?? 0;
    const n = CATEGORIAS_EMPRESA[c].natureza;
    if (n === "imposto") impostos += v;
    else if (n === "variavel") custosVariaveis += v;
    else despesasFixas += v;
  }
  const receitaLiquida = receitaBruta - impostos;
  const margemContribuicao = receitaLiquida - custosVariaveis;
  const margemContribuicaoPct = receitaBruta > 0 ? margemContribuicao / receitaBruta : null;
  const lucroOperacional = margemContribuicao - despesasFixas;
  const margemLiquidaPct = receitaBruta > 0 ? lucroOperacional / receitaBruta : null;
  const retido = e.retido ?? 0;
  const pontoDeEquilibrio = margemContribuicaoPct !== null && margemContribuicaoPct > 0 ? despesasFixas / margemContribuicaoPct : null;
  return {
    receitaBruta,
    impostos,
    receitaLiquida,
    custosVariaveis,
    margemContribuicao,
    margemContribuicaoPct,
    despesasFixas,
    lucroOperacional,
    margemLiquidaPct,
    retido,
    sobraNoCaixa: lucroOperacional - retido,
    pontoDeEquilibrio,
  };
}

// ─── Caixa ───────────────────────────────────────────────────────────────────────────────

export type SaudeDoCaixa = {
  /** O que está marcado como reserva na carteira da empresa. */
  caixa: number;
  /** Despesas fixas por mês (média dos últimos meses). */
  despesasFixasMes: number;
  /** Quantos meses o caixa cobre as despesas fixas sem faturar nada. `null` sem despesas fixas. */
  mesesDeCaixa: number | null;
  /** Sebrae: de 3 a 6 meses. */
  situacao: "sem-dado" | "curto" | "ok" | "folgado";
};

export function saudeDoCaixa(caixa: number, despesasFixasMes: number): SaudeDoCaixa {
  if (despesasFixasMes <= 0) return { caixa, despesasFixasMes, mesesDeCaixa: null, situacao: "sem-dado" };
  const meses = caixa / despesasFixasMes;
  return { caixa, despesasFixasMes, mesesDeCaixa: meses, situacao: meses < 3 ? "curto" : meses < 6 ? "ok" : "folgado" };
}

/** Quantos meses de despesas fixas uma empresa deveria ter em caixa (Sebrae: 3 a 6). */
export const MESES_DE_CAIXA_RECOMENDADOS = { minimo: 3, confortavel: 6 } as const;
