"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { createSimulation, deleteSimulation, getSimulation } from "@/lib/repositories/simulation.repo";
import { createGoal } from "@/lib/repositories/goal.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";

const salvarSchema = z.object({
  type: z.enum(["FINANCIAR_VS_ALUGAR", "AMORTIZAR_VS_INVESTIR", "CONSORCIO_VS_FINANCIAMENTO", "MARCACAO_MERCADO", "CARRO"]),
  name: z.string().trim().max(80).optional(),
  // Os valores da simulação vêm do cliente, então o que entra no banco é validado aqui:
  // só números e textos curtos, nada aninhado — é um formulário, não um documento.
  inputs: z.record(z.string().max(60), z.union([z.number(), z.string().max(120)])),
  resumo: z.string().trim().max(200),
});

export type SaveSimulationState = { ok?: boolean; error?: string };

export async function saveSimulationAction(input: unknown): Promise<SaveSimulationState> {
  // A sessão vem antes da validação porque a mensagem de erro fala na voz do tema da pessoa.
  const ctx = await getRequiredSession();
  const parsed = salvarSchema.safeParse(input);
  if (!parsed.success) return { error: vozDoTema(ctx.profileTheme, ctx.profileKind).titulos.simSalvarErro };

  await createSimulation(ctx, {
    type: parsed.data.type,
    name: parsed.data.name?.length ? parsed.data.name : null,
    inputJson: parsed.data.inputs,
    // Guarda a FRASE do resultado, não o objeto inteiro: é o que a lista precisa mostrar, e
    // o cálculo é refeito do zero ao reabrir — resultado velho de fórmula velha seria mentira.
    outputJson: { resumo: parsed.data.resumo },
  });
  revalidatePath("/simuladores");
  return { ok: true };
}

export async function deleteSimulationAction(id: string): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  await deleteSimulation(ctx, id);
  revalidatePath("/simuladores");
  return { ok: true };
}

/** Valores de uma simulação salva, pra reabrir o simulador já preenchido. */
export async function loadSimulationInputsAction(id: string): Promise<Record<string, number | string> | null> {
  const ctx = await getRequiredSession();
  const s = await getSimulation(ctx, id);
  if (!s || typeof s.inputJson !== "object" || s.inputJson === null || Array.isArray(s.inputJson)) return null;
  const saida: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(s.inputJson)) {
    if (typeof v === "number" || typeof v === "string") saida[k] = v;
  }
  return saida;
}

const metaSchema = z.object({
  nome: z.string().trim().min(1).max(60),
  alvo: z.number().positive().max(1e9),
  icone: z.enum(["CASA", "CARRO", "GENERICO"]),
});

/**
 * "Virar meta" no fim de uma calculadora (versão nova, 11/10/2026): a entrada do imóvel, o carro
 * ou a compra viram uma meta com o valor da conta e 24 meses de prazo (como no protótipo). Ela
 * ajusta o prazo depois, em Metas.
 */
export async function virarMetaAction(input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ctx = await getRequiredSession();
  const parsed = metaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Não deu para criar a meta com esse valor." };
  const hoje = nowInBrazil();
  const targetDate = new Date(hoje.getFullYear(), hoje.getMonth() + 24, 1, 12);
  const meta = await createGoal(ctx, { name: parsed.data.nome, targetAmount: Math.round(parsed.data.alvo * 100) / 100, targetDate, currentAmount: 0, annualRate: 0, icon: parsed.data.icone });
  revalidatePath("/planejamento/metas");
  revalidatePath("/mensal/foco");
  return { ok: true, id: meta.id };
}
