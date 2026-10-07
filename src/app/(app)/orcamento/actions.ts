"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { definirPlanoDoMes, listBudgets, salvarPlanoDoAno } from "@/lib/repositories/budget.repo";
import { createCustomCategory, deleteOwnCustomCategory, listCustomCategories } from "@/lib/repositories/custom-category.repo";
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
 * Tudo vai numa transação só (salvarPlanoDoAno, 07/10/2026): antes eram uma transação por categoria
 * em paralelo, perto de 100 comandos num plano completo, e o "Salvar" demorava a confirmar.
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
  const pais: { parentCategory: (typeof PARENT_CATEGORIES)[number]; plannedAmount: number }[] = [];
  for (const parentCategory of PARENT_CATEGORIES) {
    const raw = formData.get(`plannedAmount_${parentCategory}`);
    if (!mudouDoCarregado(raw, formData.get(`plannedOriginal_${parentCategory}`))) continue;
    const parsed = annualBudgetSchema.safeParse({ year, parentCategory, plannedAmount: raw });
    if (!parsed.success) return { error: "Algum valor não pôde ser salvo, confira os campos e tente de novo." };
    pais.push({ parentCategory: parsed.data.parentCategory, plannedAmount: parsed.data.plannedAmount });
  }

  const personalizadas: { customCategoryId: string; plannedAmount: number }[] = [];
  for (const customCategoryId of customCategoryIds) {
    const raw = formData.get(`plannedAmount_custom_${customCategoryId}`);
    if (!mudouDoCarregado(raw, formData.get(`plannedOriginal_custom_${customCategoryId}`))) continue;
    const parsed = annualBudgetForCustomCategorySchema.safeParse({ year, customCategoryId, plannedAmount: raw });
    if (!parsed.success) return { error: "Algum valor não pôde ser salvo, confira os campos e tente de novo." };
    personalizadas.push({ customCategoryId: parsed.data.customCategoryId, plannedAmount: parsed.data.plannedAmount });
  }

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
    // Mesmos meses para categorias, renda e aporte: mês já vivido não é reescrito.
    await salvarPlanoDoAno(ctx, year, { pais, proprias: personalizadas, planoMensal: planoValido && planoMudou ? planejado : null }, mesesQueOSalvarGrava(year, hoje));
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

function revalidarOrcamento() {
  revalidatePath("/orcamento", "layout");
  revalidatePath("/mensal", "layout");
}

/**
 * "Lazer passou R$ 60. Cobrir com a sobra de Transporte?" (01/10/2026): só este mês, tira `valor`
 * do planejado de uma categoria e põe na outra. O total do mês não muda.
 */
export async function cobrirCategoriaAction(input: { de: string; para: string; valor: number }): Promise<{ error?: string }> {
  const ctx = await getRequiredSession();
  const valor = Math.round(Number(input.valor) * 100) / 100;
  if (!(valor > 0) || valor > 1e8 || input.de === input.para) return { error: "Valor inválido." };
  const agora = nowInBrazil();
  const year = agora.getFullYear();
  const month = agora.getMonth() + 1;
  const planos = await listBudgets(ctx, year, month);
  const plano = (k: string) => Number(planos.find((b) => (b.customCategoryId ?? b.parentCategory) === k)?.plannedAmount ?? 0);
  if (plano(input.de) < valor) return { error: "Essa categoria não tem essa sobra no plano." };
  const ok1 = await definirPlanoDoMes(ctx, { key: input.de, year, month, plannedAmount: plano(input.de) - valor });
  const ok2 = ok1 && (await definirPlanoDoMes(ctx, { key: input.para, year, month, plannedAmount: plano(input.para) + valor }));
  if (!ok2) return { error: "Categoria não encontrada." };
  revalidarOrcamento();
  return {};
}

/** O lápis do "Planejado" no detalhe da categoria: vale deste mês até dezembro. */
export async function definirPlanoDaCategoriaAction(input: { key: string; valor: number }): Promise<{ error?: string }> {
  const ctx = await getRequiredSession();
  const valor = Math.round(Number(input.valor) * 100) / 100;
  if (!(valor >= 0) || valor > 1e8) return { error: "Valor inválido." };
  const agora = nowInBrazil();
  const year = agora.getFullYear();
  for (const month of mesesQueOSalvarGrava(year, agora)) {
    if (!(await definirPlanoDoMes(ctx, { key: input.key, year, month, plannedAmount: valor }))) return { error: "Categoria não encontrada." };
  }
  revalidarOrcamento();
  return {};
}

/**
 * "Ajustar categorias" (03/10/2026): aplica de uma vez todos os ajustes do padrão dos últimos
 * 3 meses. Ela pediu um botão só em vez de um por categoria; depois mexe no que quiser pelo lápis.
 * Vale deste mês até dezembro, igual ao lápis. Para no primeiro erro e diz qual categoria falhou.
 */
export async function aplicarAjustesDoPadraoAction(itens: { key: string; valor: number }[]): Promise<{ error?: string; aplicados?: number }> {
  const ctx = await getRequiredSession();
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 20) return { error: "Nada para ajustar." };
  const agora = nowInBrazil();
  const year = agora.getFullYear();
  const meses = mesesQueOSalvarGrava(year, agora);
  let aplicados = 0;
  for (const item of itens) {
    const valor = Math.round(Number(item.valor) * 100) / 100;
    if (typeof item.key !== "string" || !(valor >= 0) || valor > 1e8) return { error: "Valor inválido.", aplicados };
    for (const month of meses) {
      if (!(await definirPlanoDoMes(ctx, { key: item.key, year, month, plannedAmount: valor }))) return { error: "Categoria não encontrada.", aplicados };
    }
    aplicados++;
  }
  revalidarOrcamento();
  return { aplicados };
}
