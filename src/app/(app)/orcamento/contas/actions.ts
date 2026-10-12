"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { hojeEmBrasilia, lerData } from "@/lib/contas/contas";
import { fecharAvisoDasContas } from "@/lib/repositories/contas-do-historico.repo";
import { apagarContaAPagar, criarContaAPagar, desfazerContaPaga, editarContaAPagar, historicoDaConta, marcarContaPaga } from "@/lib/repositories/conta-a-pagar.repo";

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
  // Frequência livre (seção 3.17). Tudo opcional: o formulário de antes continua valendo.
  intervalo: z.number().int().min(1).max(36).nullable().optional(),
  unidade: z.enum(["dias", "semanas", "meses", "anos"]).nullable().optional(),
  mesesEscolhidos: z.array(z.number().int().min(1).max(12)).max(12).optional(),
  parcelas: z.number().int().min(2).max(48).nullable().optional(),
  parcelaAtual: z.number().int().min(1).max(48).nullable().optional(),
  valorEhTotal: z.boolean().optional(),
  aproximado: z.boolean().optional(),
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
  if (d.parcelas && !d.parcelaAtual) d.parcelaAtual = 1;
  if (d.parcelaAtual && d.parcelas && d.parcelaAtual > d.parcelas) return { ok: false, erro: "A parcela de agora passa do total." };
  const ctx = await getRequiredSession();
  if (id) await editarContaAPagar(ctx, id, d);
  else await criarContaAPagar(ctx, d);
  revalidar();
  return { ok: true };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Devolve o vencimento pago (pra desfazer) e o próximo, se a conta repete. */
export async function pagarContaAction(id: string): Promise<{ antes: string; antesParcela: number | null; proxima: string | null } | null> {
  const ctx = await getRequiredSession();
  const r = await marcarContaPaga(ctx, z.string().min(1).parse(id));
  revalidar();
  if (!r) return null;
  return { antes: iso(r.antes), antesParcela: r.antesParcela, proxima: r.quitada ? null : iso(r.vencimento) };
}

export async function desfazerPagamentoAction(id: string, antes: string, antesParcela?: number | null) {
  const ctx = await getRequiredSession();
  const d = lerData(antes);
  if (!d) return;
  await desfazerContaPaga(ctx, z.string().min(1).parse(id), d, antesParcela === undefined ? undefined : z.number().int().min(1).max(48).nullable().parse(antesParcela));
  revalidar();
}

/** "Nos últimos 3 meses a luz deu em média R$ 128": o que a conta deu no extrato, para sugerir. */
export async function historicoDaContaAction(nome: string): Promise<{ mes: string; valor: number }[]> {
  const n = z.string().trim().max(80).safeParse(nome);
  if (!n.success) return [];
  const ctx = await getRequiredSession();
  return historicoDaConta(ctx, n.data, hojeEmBrasilia());
}

export async function apagarContaAction(id: string) {
  const ctx = await getRequiredSession();
  await apagarContaAPagar(ctx, z.string().min(1).parse(id));
  revalidar();
}

/** "Desfazer" no aviso das contas achadas: apaga e guarda a recusa (nunca volta). */
export async function desfazerContaDoHistoricoAction(id: string) {
  const ctx = await getRequiredSession();
  await apagarContaAPagar(ctx, z.string().min(1).parse(id));
  revalidar();
}

/** O X do aviso: as contas achadas até aqui não aparecem mais nele. */
export async function fecharAvisoDasContasAction() {
  const ctx = await getRequiredSession();
  await fecharAvisoDasContas(ctx);
  revalidar();
}
