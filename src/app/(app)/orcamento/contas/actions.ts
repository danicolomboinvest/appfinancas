"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { lerData } from "@/lib/contas/contas";
import { apagarContaAPagar, criarContaAPagar, desfazerContaPaga, editarContaAPagar, marcarContaPaga } from "@/lib/repositories/conta-a-pagar.repo";

const dataSchema = z.string().transform((s, c) => {
  const d = lerData(s);
  if (!d) {
    c.addIssue({ code: "custom", message: "Escolha o dia do vencimento." });
    return z.NEVER;
  }
  return d;
});

const contaSchema = z.object({
  id: z.string().min(1).optional(),
  nome: z.string().trim().min(1, "Diga o que é a conta.").max(80),
  // Valor enorme não derruba a tela: corta em vez de recusar.
  valor: z.number().positive().transform((v) => Math.min(v, 100_000_000)).nullable(),
  vencimento: dataSchema,
  repete: z.boolean(),
  lembrar: z.boolean(),
});

function revalidar() {
  // O Orçamento inteiro: a tela das contas e o atalho com o resumo, na página de cada ano.
  revalidatePath("/orcamento", "layout");
  revalidatePath("/mensal/foco");
}

export async function salvarContaAction(input: z.input<typeof contaSchema>): Promise<{ ok: true } | { ok: false; erro: string }> {
  const r = contaSchema.safeParse(input);
  if (!r.success) return { ok: false, erro: r.error.issues[0]?.message ?? "Confira os campos." };
  const { id, ...d } = r.data;
  const ctx = await getRequiredSession();
  if (id) await editarContaAPagar(ctx, id, d);
  else await criarContaAPagar(ctx, d);
  revalidar();
  return { ok: true };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Devolve o vencimento pago (pra desfazer) e o próximo, se a conta repete. */
export async function pagarContaAction(id: string): Promise<{ antes: string; proxima: string | null } | null> {
  const ctx = await getRequiredSession();
  const r = await marcarContaPaga(ctx, z.string().min(1).parse(id));
  revalidar();
  if (!r) return null;
  return { antes: iso(r.antes), proxima: r.quitada ? null : iso(r.vencimento) };
}

export async function desfazerPagamentoAction(id: string, antes: string) {
  const ctx = await getRequiredSession();
  const d = lerData(antes);
  if (!d) return;
  await desfazerContaPaga(ctx, z.string().min(1).parse(id), d);
  revalidar();
}

export async function apagarContaAction(id: string) {
  const ctx = await getRequiredSession();
  await apagarContaAPagar(ctx, z.string().min(1).parse(id));
  revalidar();
}
