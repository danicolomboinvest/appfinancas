"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { hojeEmBrasilia, lerData } from "@/lib/contas/contas";
import { fecharAvisoDasContas } from "@/lib/repositories/contas-do-historico.repo";
import { apagarContaAPagar, criarContaAPagar, desfazerContaPaga, editarContaAPagar, historicoDaConta, pagarContaComGasto } from "@/lib/repositories/conta-a-pagar.repo";
import { diaValido, origemValida } from "@/lib/contas/paguei";
import { categoriaDoPaguei } from "@/lib/contas/paguei-categoria";
import { acertarGuiaDepoisDoPaguei } from "@/lib/empresa/acertar-guia";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { prisma } from "@/lib/db/prisma";

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
  // A categoria escolhida na folha (29/10/2026). Sem ela, a conta fica como antes (o Paguei adivinha).
  categoria: z.enum(["MORADIA", "ALIMENTACAO", "TRANSPORTE", "SAUDE", "LAZER", "EDUCACAO", "OUTROS", "IMPOSTOS"]).nullable().optional(),
  // A categoria personalizada dela (30/10/2026): o repositório confere que é dela e zera a padrão.
  customCategoryId: z.string().min(1).max(40).nullable().optional(),
});

function revalidar() {
  // O Orçamento inteiro: a tela das contas e o atalho com o resumo, na página de cada ano.
  revalidatePath("/orcamento", "layout");
  revalidatePath("/mensal/foco");
}

/** O "Paguei" cria gasto: o Resumo, o mês e o Orçamento mudam junto. */
function revalidarComGasto() {
  revalidar();
  revalidatePath("/mensal", "layout");
  revalidatePath("/empresa", "layout");
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

export type ResultadoDoPaguei =
  | { ok: true; antes: string; antesParcela: number | null; proxima: string | null; lancamentoId: string }
  | { ok: false; erro: string };

/**
 * "Paguei" (versão B): cria o gasto com o valor, o dia e a origem que a linha mandou, marca a conta
 * como paga e passa o vencimento. Devolve o vencimento pago e o id do gasto (para o Desfazer).
 */
export async function pagarContaAction(id: string, escolha: { valor: number; dia: string; origem: string }): Promise<ResultadoDoPaguei> {
  const ctx = await getRequiredSession();
  const valor = typeof escolha?.valor === "number" && Number.isFinite(escolha.valor) ? Math.round(escolha.valor * 100) / 100 : 0;
  if (!(valor > 0) || valor > 100_000_000) return { ok: false, erro: "Falta o valor" };
  if (!diaValido(escolha?.dia, iso(hojeEmBrasilia()))) return { ok: false, erro: "Escolha o dia" };
  if (!origemValida(escolha?.origem)) return { ok: false, erro: "Escolha de onde saiu" };
  const r = await pagarContaComGasto(ctx, z.string().min(1).parse(id), { valor, dia: escolha.dia, origem: escolha.origem });
  if (r) await acertarGuiaDepoisDoPaguei(ctx, r.nome);
  revalidarComGasto();
  if (!r) return { ok: false, erro: "Essa conta já estava paga" };
  return { ok: true, antes: iso(r.antes), antesParcela: r.antesParcela, proxima: r.quitada ? null : iso(r.vencimento), lancamentoId: r.lancamentoId };
}

/** Desfazer o "Paguei": volta o vencimento e apaga o gasto que ele criou. */
export async function desfazerPagamentoAction(id: string, antes: string, antesParcela?: number | null, lancamentoId?: string | null) {
  const ctx = await getRequiredSession();
  const d = lerData(antes);
  if (!d) return;
  await desfazerContaPaga(
    ctx,
    z.string().min(1).parse(id),
    d,
    antesParcela === undefined ? undefined : z.number().int().min(1).max(48).nullable().parse(antesParcela),
    lancamentoId ? z.string().min(1).max(40).parse(lancamentoId) : null,
  );
  // A guia do MEI desfeita: a conta volta a seguir a guia paga antes desta.
  if (ehEmpresa(ctx.profileKind)) {
    const c = await prisma.contaAPagar.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, select: { nome: true } });
    if (c) await acertarGuiaDepoisDoPaguei(ctx, c.nome);
  }
  revalidarComGasto();
}

/** A categoria que o Paguei daria para esse nome: a folha já abre com ela marcada. */
export async function sugerirCategoriaDaContaAction(nome: string): Promise<string> {
  const n = z.string().trim().min(1).max(80).safeParse(nome);
  if (!n.success) return "OUTROS";
  const ctx = await getRequiredSession();
  return categoriaDoPaguei({ nome: n.data, categoria: null, profileKind: ctx.profileKind }).parentCategory ?? "OUTROS";
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
