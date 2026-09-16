"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { createSimulation, deleteSimulation, getSimulation } from "@/lib/repositories/simulation.repo";

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
  const parsed = salvarSchema.safeParse(input);
  if (!parsed.success) return { error: "Não consegui salvar esta simulação." };

  const ctx = await getRequiredSession();
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
