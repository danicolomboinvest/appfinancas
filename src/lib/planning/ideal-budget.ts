import type { ParentCategory, ProfileKind } from "@prisma/client";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { ehEmpresa } from "@/lib/profiles/empresa";

/**
 * Distribuição do Orçamento — a que a Dani ensina na aula "Organização financeira".
 *
 * Os percentuais são sobre a RENDA, não sobre o que sobra: a aula reparte os 100% do salário
 * assim (somando 100):
 *
 *   Habitação 30% · Alimentação 15% · Saúde 10% · Liberdade Financeira 10% · Transporte 8%
 *   Sonhos 8% · Educação 5% · Lazer 5% · Outros 5% · Despesas pessoais 4%
 *
 * Liberdade Financeira (10%) e Sonhos (8%) são o que se guarda — no app, o aporte e as metas,
 * que já são o passo 2 do assistente. Sobram 82% de gasto, que é o que esta tabela divide.
 *
 * "Outros" da aula é a categoria Outros do app. "Despesas pessoais" entra em Lazer, que já
 * abriga presentes, passeios e hobbies. Impostos existe como categoria própria no app, mas a
 * aula não reserva fatia pra ela (pra quem é CLT o imposto já vem descontado do salário), então
 * a sugestão deixa em zero e quem tem IPTU, IPVA ou DARF preenche.
 *
 * Trocar os números do curso é mexer só na tabela abaixo.
 */
export type IdealShares = Record<ParentCategory, number>;

/** Quanto da renda a aula destina a cada categoria de GASTO (soma 0,82 = os 82% que não se guarda). */
const COURSE_SHARES_OF_INCOME: IdealShares = {
  MORADIA: 0.3,
  ALIMENTACAO: 0.15,
  SAUDE: 0.1,
  TRANSPORTE: 0.08,
  LAZER: 0.09, // Lazer 5% + Despesas pessoais 4%
  EDUCACAO: 0.05,
  OUTROS: 0.05,
  IMPOSTOS: 0, // a aula não separa imposto; quem tem preenche à mão
};

/** Quanto a aula manda guardar: 10% liberdade financeira + 8% sonhos. */
export const COURSE_SAVINGS_PERCENT = 18;

/** O total de gasto da referência (0,82). Serve pra tela dizer que sobrou margem. */
export const COURSE_SPENDING_SHARE = Object.values(COURSE_SHARES_OF_INCOME).reduce((a, b) => a + b, 0);

/**
 * A mesma régua, pra EMPRESA. Aqui os percentuais são sobre o FATURAMENTO, e as oito chaves
 * do banco significam outra coisa (ver src/lib/profiles/empresa.ts): SAUDE é equipe e
 * pró-labore, ALIMENTACAO é mercadorias e insumos, MORADIA é estrutura, e por aí vai.
 *
 * Os pesos seguem a ordem que uma pequena empresa paga as contas: imposto e gente primeiro
 * (o DAS não espera e a folha também não), depois o que se compra pra vender, depois o teto,
 * e só então marketing, terceiros e logística. Somam 0,90: os 10% que faltam são a retenção
 * (reserva de caixa e reinvestimento), que é o passo 2 do assistente, igual ao "guardar" da
 * pessoa física. É ponto de partida, não lei: cada negócio tem a própria conta.
 */
const EMPRESA_SHARES_OF_REVENUE: IdealShares = {
  IMPOSTOS: 0.1, // Impostos e taxas
  SAUDE: 0.25, // Equipe e pró-labore
  ALIMENTACAO: 0.25, // Mercadorias e insumos
  MORADIA: 0.1, // Estrutura
  EDUCACAO: 0.08, // Marketing e vendas
  LAZER: 0.05, // Serviços e terceiros
  TRANSPORTE: 0.04, // Logística e entregas
  OUTROS: 0.03,
};

/** Quanto a empresa retém do faturamento na referência: reserva de caixa e reinvestimento. */
export const EMPRESA_RETENTION_PERCENT = 10;

/** O total de custo e despesa da referência da empresa (0,90). */
export const EMPRESA_SPENDING_SHARE = Object.values(EMPRESA_SHARES_OF_REVENUE).reduce((a, b) => a + b, 0);

type Kind = ProfileKind | string | null | undefined;

/** A tabela do perfil: a do curso pra pessoa, a da pequena empresa pra EMPRESA. */
function sharesFor(kind: Kind): IdealShares {
  return ehEmpresa(kind) ? EMPRESA_SHARES_OF_REVENUE : COURSE_SHARES_OF_INCOME;
}

/** Quanto a referência do perfil manda guardar (pessoa) ou reter (empresa), em %. */
export function savingsPercentFor(kind: Kind): number {
  return ehEmpresa(kind) ? EMPRESA_RETENTION_PERCENT : COURSE_SAVINGS_PERCENT;
}

/** A fração da renda (ou do faturamento) que a referência do perfil destina a gasto. */
export function spendingShareFor(kind: Kind): number {
  return ehEmpresa(kind) ? EMPRESA_SPENDING_SHARE : COURSE_SPENDING_SHARE;
}

/**
 * Divide o que sobra pra gastar seguindo a aula.
 *
 * Como os percentuais são sobre a renda, quem guarda os 18% da aula recebe exatamente os
 * números dela (renda 16.000 → moradia 4.800, alimentação 2.400, saúde 1.600…). Quem guarda
 * MAIS do que isso não cabe na régua inteira, então tudo encolhe na mesma proporção — é o
 * "de acordo com o que a pessoa pode". Quem guarda menos fica com uma folga por distribuir,
 * que é margem de segurança, não erro.
 *
 * - `reserved`: o que já está posto em categorias que a própria pessoa criou; sai do bolo antes.
 * - `kind`: o tipo do perfil. Sem ele (ou PESSOAL) é a régua do curso; EMPRESA usa a tabela
 *   da pequena empresa sobre o faturamento, com a mesma mecânica de encolher e de folga.
 *
 * Os valores saem em reais inteiros, sem arredondar de 50 em 50: 8% de 16.000 é 1.280 e é isso
 * que a aula manda pôr em transporte — arredondar pra 1.300 mudaria o número que a Dani ensina.
 */
export function idealBudgetSplit(
  toSpend: number,
  monthlyIncome: number,
  options: { reserved?: number; kind?: Kind } = {},
): IdealShares {
  const { reserved = 0, kind } = options;
  const shares = sharesFor(kind);
  const pot = Math.max(0, toSpend - Math.max(0, reserved));
  const empty = Object.fromEntries(PARENT_CATEGORIES.map((c) => [c, 0])) as IdealShares;
  if (pot <= 0 || monthlyIncome <= 0) return empty;

  const raw = Object.fromEntries(PARENT_CATEGORIES.map((c) => [c, monthlyIncome * shares[c]])) as IdealShares;
  const rawTotal = PARENT_CATEGORIES.reduce((s, c) => s + raw[c], 0);
  const scaled = rawTotal > pot;
  const scale = scaled ? pot / rawTotal : 1;

  const out = { ...empty };
  for (const c of PARENT_CATEGORIES) out[c] = Math.max(0, Math.round(raw[c] * scale));

  // Só force a soma a fechar quando a régua teve que encolher. Quem guarda menos que a aula
  // fica com a folga aparecendo em "sobram X pra distribuir", que é informação, não sobra solta.
  if (scaled) {
    const diff = Math.round((pot - PARENT_CATEGORIES.reduce((s, c) => s + out[c], 0)) * 100) / 100;
    if (diff !== 0) {
      const biggest = PARENT_CATEGORIES.reduce((m, c) => (out[c] > out[m] ? c : m), PARENT_CATEGORIES[0]);
      out[biggest] = Math.max(0, Math.round((out[biggest] + diff) * 100) / 100);
    }
  }
  return out;
}

/** Percentual da renda (ou do faturamento) que a referência do perfil destina a cada categoria, pra tela explicar a sugestão. */
export function courseShareOf(category: ParentCategory, kind?: Kind): number {
  return sharesFor(kind)[category];
}
