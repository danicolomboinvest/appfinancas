import type { ParentCategory } from "@prisma/client";
import { PARENT_CATEGORIES } from "@/lib/categories";

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
 * Divide o que sobra pra gastar seguindo a aula.
 *
 * Como os percentuais são sobre a renda, quem guarda os 18% da aula recebe exatamente os
 * números dela (renda 16.000 → moradia 4.800, alimentação 2.400, saúde 1.600…). Quem guarda
 * MAIS do que isso não cabe na régua inteira, então tudo encolhe na mesma proporção — é o
 * "de acordo com o que a pessoa pode". Quem guarda menos fica com uma folga por distribuir,
 * que é margem de segurança, não erro.
 *
 * - `reserved`: o que já está posto em categorias que a própria pessoa criou; sai do bolo antes.
 *
 * Os valores saem em reais inteiros, sem arredondar de 50 em 50: 8% de 16.000 é 1.280 e é isso
 * que a aula manda pôr em transporte — arredondar pra 1.300 mudaria o número que a Dani ensina.
 */
export function idealBudgetSplit(
  toSpend: number,
  monthlyIncome: number,
  options: { reserved?: number } = {},
): IdealShares {
  const { reserved = 0 } = options;
  const pot = Math.max(0, toSpend - Math.max(0, reserved));
  const empty = Object.fromEntries(PARENT_CATEGORIES.map((c) => [c, 0])) as IdealShares;
  if (pot <= 0 || monthlyIncome <= 0) return empty;

  const raw = Object.fromEntries(PARENT_CATEGORIES.map((c) => [c, monthlyIncome * COURSE_SHARES_OF_INCOME[c]])) as IdealShares;
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

/** Percentual da renda que a aula destina a cada categoria, pra tela explicar a sugestão. */
export function courseShareOf(category: ParentCategory): number {
  return COURSE_SHARES_OF_INCOME[category];
}
