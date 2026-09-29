"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { applyBudgetToWholeYear, applyBudgetToWholeYearForCustomCategory } from "@/lib/repositories/budget.repo";
import { createCustomCategory, deleteOwnCustomCategory, listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { applyMonthlyPlanToWholeYear } from "@/lib/repositories/monthly-plan.repo";
import { annualBudgetSchema, annualBudgetForCustomCategorySchema } from "@/lib/validations/budget.schema";
import { customCategorySchema } from "@/lib/validations/custom-category.schema";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { anoFechado, mesesQueOSalvarGrava, mudouDoCarregado } from "@/lib/planning/plano-anual";

export type AnnualBudgetState = { error?: string };

/**
 * Salva o planejamento de todas as categorias (padrão + personalizadas) de uma vez, um único
 * botão "Salvar tudo" em vez de um "Salvar" por cartão. Os campos chegam nomeados
 * `plannedAmount_<ParentCategory>` e `plannedAmount_custom_<id>` (ver BudgetWizard.tsx).
 * Cada categoria já é salva de forma atômica internamente (applyBudgetToWholeYear faz um
 * $transaction pros 12 meses); aplicamos todas em paralelo já que são independentes entre si.
 */
export async function applyAllBudgetsAction(
  _prevState: AnnualBudgetState,
  formData: FormData,
): Promise<AnnualBudgetState> {
  const year = Number(formData.get("year"));
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  // Ano que já acabou: as categorias não eram gravadas (nenhum mês a tocar), mas a tela dizia
  // "salvo" e renda/aporte dos 12 meses eram reescritos. Recusa dizendo o porquê.
  if (!Number.isInteger(year)) return { error: "Algum valor não pôde ser salvo, confira os campos e tente de novo." };
  if (anoFechado(year, hoje)) {
    return { error: "Esse ano já fechou, o plano dele não pode mais ser alterado." };
  }
  // O plano do ano inteiro é gravado no perfil ATIVO. Se ela trocou de perfil em outra aba
  // depois de abrir esta tela, os números do formulário são do perfil anterior: gravar aqui
  // copiaria o plano de um perfil no outro.
  const perfilDaTela = formData.get("profileId");
  if (typeof perfilDaTela === "string" && perfilDaTela !== "" && perfilDaTela !== ctx.profileId) {
    return { error: "Você trocou de perfil; recarregue a página." };
  }

  // Só as categorias do próprio perfil: o id vem do formulário, e um id qualquer criava orçamento
  // neste perfil apontando pra categoria de outro.
  const proprias = new Set((await listCustomCategories(ctx)).map((c) => c.id));
  const customCategoryIds = formData
    .getAll("customCategoryId")
    .map(String)
    .filter((id) => proprias.has(id));

  // Só grava o que ela mexeu. O formulário manda todas as categorias, e regravar as intocadas
  // espalhava pro resto do ano um ajuste "só deste mês" (o do Fechamento, o do aviso do Foco).
  const parentWrites = PARENT_CATEGORIES.flatMap((parentCategory) => {
    const raw = formData.get(`plannedAmount_${parentCategory}`);
    if (!mudouDoCarregado(raw, formData.get(`plannedOriginal_${parentCategory}`))) return [];
    const parsed = annualBudgetSchema.safeParse({ year, parentCategory, plannedAmount: raw });
    return [parsed.success ? applyBudgetToWholeYear(ctx, parsed.data) : Promise.reject(parsed.error)];
  });

  const customWrites = customCategoryIds.flatMap((customCategoryId) => {
    const raw = formData.get(`plannedAmount_custom_${customCategoryId}`);
    if (!mudouDoCarregado(raw, formData.get(`plannedOriginal_custom_${customCategoryId}`))) return [];
    const parsed = annualBudgetForCustomCategorySchema.safeParse({ year, customCategoryId, plannedAmount: raw });
    return [
      parsed.success
        ? applyBudgetToWholeYearForCustomCategory(ctx, parsed.data)
        : Promise.reject(parsed.error),
    ];
  });

  // Renda e aporte planejados vêm no MESMO formulário: planejar é decidir quanto entra,
  // quanto sai e quanto fica guardado — separar em dois lugares faria a pessoa pensar que são
  // dois assuntos.
  const planejado = {
    plannedIncome: Number(formData.get("plannedIncome") ?? 0),
    plannedInvestment: Number(formData.get("plannedInvestment") ?? 0),
  };
  const planoValido =
    Number.isFinite(planejado.plannedIncome) &&
    Number.isFinite(planejado.plannedInvestment) &&
    planejado.plannedIncome >= 0 &&
    planejado.plannedInvestment >= 0;
  const planoMudou =
    mudouDoCarregado(formData.get("plannedIncome"), formData.get("plannedIncomeOriginal")) ||
    mudouDoCarregado(formData.get("plannedInvestment"), formData.get("plannedInvestmentOriginal"));

  try {
    await Promise.all([
      ...parentWrites,
      ...customWrites,
      // Mesmos meses das categorias: renda e aporte de mês já vivido não são reescritos.
      planoValido && planoMudou ? applyMonthlyPlanToWholeYear(ctx, year, planejado, mesesQueOSalvarGrava(year, hoje)) : Promise.resolve(),
    ]);
  } catch {
    return { error: "Algum valor não pôde ser salvo, confira os campos e tente de novo." };
  }

  // A tela do plano é /orcamento/[ano]: sem revalidar ela, a página continuava com os valores
  // antigos depois de salvar. O Foco e o Posso comprar também leem o orçamento.
  revalidatePath("/orcamento", "layout");
  revalidatePath(`/mensal/${year}`);
  revalidatePath("/mensal/foco");
  revalidatePath("/decidir/comprar");
  return {};
}

export type CustomCategoryState = { error?: string };

export async function createCustomCategoryAction(
  _prevState: CustomCategoryState,
  formData: FormData,
): Promise<CustomCategoryState> {
  const parsed = customCategorySchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  try {
    await createCustomCategory(ctx, parsed.data);
  } catch {
    return { error: "Você já tem uma categoria com esse nome." };
  }
  revalidatePath("/orcamento");
  return {};
}

export async function deleteCustomCategoryAction(id: string): Promise<void> {
  const ctx = await getRequiredSession();
  await deleteOwnCustomCategory(ctx, id);
  revalidatePath("/orcamento");
  revalidatePath("/orcamento/comparativo");
}
