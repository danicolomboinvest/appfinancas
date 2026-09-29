import type { ParentCategory, ProfileKind } from "@prisma/client";
import { Building2, Package, Truck, Users, Megaphone, Handshake, Landmark, Shapes, type LucideIcon } from "lucide-react";
import { ehNaoGasto } from "@/lib/planning/nao-e-gasto";

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

/**
 * Só as linhas dos meses que já aconteceram (`month <= mesesPassados`). A DRE do ano soma a
 * receita só até o mês corrente (o resumo do ano não conta mês futuro), mas o gasto por
 * categoria vem do banco com as cópias de lançamento recorrente até dezembro. Sem cortar os
 * dois no mesmo ponto, o aluguel de out–dez entra contra uma receita de jan–set e o lucro,
 * as margens e o ponto de equilíbrio do ano saem menores do que são.
 */
export function soMesesJaVividos<T extends { month: number }>(linhas: T[], mesesPassados: number): T[] {
  return linhas.filter((l) => l.month <= mesesPassados);
}

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
  /** O caixa de segurança: o digitado na tela do caixa ou o marcado como reserva na carteira. */
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

export type LinhaDoHistorico = {
  year: number;
  month: number;
  category: string;
  parentCategory: ParentCategory | null;
  subcategory?: string | null;
  description?: string | null;
  amount: number | { toString(): string };
  createdAt?: Date | null;
};

/**
 * Despesas fixas de um mês típico, a partir dos lançamentos dos meses fechados. É a MESMA régua
 * da tela do caixa de segurança (`getTypicalMonthlyExpense`): sem ela, o Painel dizia "1,3 mês,
 * curto" enquanto a tela do caixa dizia "8 meses" pro mesmo dinheiro. Por isso:
 * - aplicação e pagamento de fatura não são despesa (o extrato traz os dois como débito);
 * - mês que só tem as cópias automáticas da conta fixa (nada lançado nele ou depois) não entra,
 *   senão puxaria a média pra baixo.
 * `null` quando não há nenhum mês com despesa fixa pra medir.
 */
export function despesasFixasTipicas(historico: LinhaDoHistorico[]): number | null {
  const fixas = new Map<string, number>();
  const reais = new Set<string>();
  for (const e of historico) {
    if (e.category !== "EXPENSE") continue;
    const chave = `${e.year}-${e.month}`;
    // Sem a data de criação (lançamento antigo) não dá pra saber: conta como mês real.
    if (!e.createdAt || e.createdAt.getTime() >= Date.UTC(e.year, e.month - 1, 1, 3)) reais.add(chave);
    if (naturezaDaCategoria(e.parentCategory) !== "fixa" || ehNaoGasto(e)) continue;
    fixas.set(chave, (fixas.get(chave) ?? 0) + Number(e.amount));
  }
  const meses = [...fixas].filter(([chave, v]) => v > 0 && reais.has(chave));
  if (meses.length === 0) return null;
  return meses.reduce((s, [, v]) => s + v, 0) / meses.length;
}

/**
 * O caixa da empresa: o maior entre o que ela digitou na tela do caixa de segurança e o que está
 * marcado como reserva na carteira. Mesma regra da fila do que guardar (`savings-targets.ts`):
 * quem não usa a carteira via "0,0 mês" no Painel com R$ 50 mil digitados na tela do caixa, e
 * somar os dois contaria o mesmo dinheiro duas vezes.
 */
export function caixaDaEmpresa(digitado: number | null, marcadoNaCarteira: number): number {
  return Math.max(digitado ?? 0, marcadoNaCarteira);
}

/** Quantos meses de despesas fixas uma empresa deveria ter em caixa (Sebrae: 3 a 6). */
export const MESES_DE_CAIXA_RECOMENDADOS = { minimo: 3, confortavel: 6 } as const;
