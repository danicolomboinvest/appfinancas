"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { planoDaMeta } from "@/lib/planning/plano-da-meta";
import { aplicarEscolhas } from "@/lib/planning/plano-gravado";
import { cobrancasDeAssinatura, entradaDoPlano, gravarPlano, metaDoPlano, planoDisponivel, tirarPlano } from "@/lib/repositories/plano-da-meta.repo";
import { ligarLembretes } from "@/lib/assinaturas/lembretes";

/**
 * "Usar esse plano" e "Tirar o plano" (16/10/2026). A tela manda só as escolhas dela (que
 * coisinhas, o valor de cada régua e o caminho quando não fecha); o servidor refaz o plano com os
 * dados de agora e confere tudo antes de gravar (lib/planning/plano-gravado.ts).
 */

type Resultado = { ok: true } | { ok: false; error: string };

const escolhasSchema = z.object({
  itens: z.array(z.object({ id: z.string().min(1).max(80), valor: z.number().min(0).max(1e8) })).max(30),
  saida: z.enum(["nenhuma", "prazo", "menor", "daa"]),
});
const idSchema = z.string().min(1).max(60);

function revalidar(id: string) {
  revalidatePath("/planejamento/metas");
  revalidatePath(`/planejamento/metas/${id}`);
  revalidatePath(`/planejamento/metas/${id}/plano`);
  revalidatePath("/mensal/foco");
}

export async function usarPlanoAction(goalId: string, escolhas: z.infer<typeof escolhasSchema>): Promise<Resultado> {
  const id = idSchema.safeParse(goalId);
  const e = escolhasSchema.safeParse(escolhas);
  if (!id.success || !e.success) return { ok: false, error: "Escolhas inválidas." };
  const ctx = await getRequiredSession();
  if (!(await planoDisponivel(ctx))) return { ok: false, error: "O plano não está disponível neste perfil." };
  const hoje = nowInBrazil();
  const meta = await metaDoPlano(ctx, id.data);
  if (!meta) return { ok: false, error: "Essa meta não existe mais. Recarregue a página." };
  const entrada = await entradaDoPlano(ctx, meta, hoje);
  const r = aplicarEscolhas(planoDaMeta(entrada), entrada.meta, e.data, hoje, cobrancasDeAssinatura(entrada.assinaturas));
  if (!r.ok) return { ok: false, error: r.erro };
  const ok = await gravarPlano(ctx, meta.id, r.plano, r.meta);
  if (!ok) return { ok: false, error: "Essa meta não existe mais. Recarregue a página." };
  // O lembrete de cancelar das assinaturas escolhidas (o mesmo do Raio-X). Falhar aqui não desfaz o plano.
  const chaves = r.plano.itens.filter((i) => i.acao === "cancelar" && i.raiox).map((i) => i.raiox as string);
  if (chaves.length > 0) {
    try {
      await ligarLembretes(ctx, chaves, hoje);
    } catch (err) {
      console.error("[plano da meta] lembrete de cancelar falhou:", err);
    }
  }
  revalidar(meta.id);
  return { ok: true };
}

/** A meta continua com o valor por mês e o prazo de agora; só o plano (tetos e avisos) sai. */
export async function tirarPlanoAction(goalId: string): Promise<Resultado> {
  const id = idSchema.safeParse(goalId);
  if (!id.success) return { ok: false, error: "Meta inválida." };
  const ctx = await getRequiredSession();
  await tirarPlano(ctx, id.data);
  revalidar(id.data);
  return { ok: true };
}
