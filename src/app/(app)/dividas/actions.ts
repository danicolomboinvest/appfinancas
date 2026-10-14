"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { doDono, getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createGoal } from "@/lib/repositories/goal.repo";
import { TIPOS, type TipoDeDivida } from "@/lib/dividas/tipos";
import { criarRecibo, lerRecibo } from "@/lib/desfazer/recibo";
import { apagarDivida, criarDivida, desfazerToque, editarDivida, pagarParcela, quitarDivida, restaurarDivida, type AntesDoToque, type DividaApagada } from "@/lib/repositories/divida.repo";

const tipos = TIPOS.map((t) => t.id) as [TipoDeDivida, ...TipoDeDivida[]];
const texto = (max: number) => z.string().trim().max(max).transform((s) => s.replace(/[<>]/g, ""));
// Valor enorme não derruba a tela: corta em vez de recusar.
const dinheiro = z.number().min(0).transform((v) => Math.min(Math.round(v * 100) / 100, 100_000_000));

const dividaSchema = z
  .object({
    id: z.string().min(1).optional(),
    tipo: z.enum(tipos),
    credor: texto(40),
    apelido: texto(40),
    paraQue: texto(40).nullable(),
    planejada: z.boolean(),
    saldo: dinheiro.refine((v) => v > 0, "Digite quanto falta pagar."),
    porMes: dinheiro,
    parcelasAbertas: z.number().int().min(0).max(999).nullable(),
    parcelasTotal: z.number().int().min(0).max(999).nullable(),
    semParcela: z.boolean(),
    taxaMensal: z.number().min(0).max(100).nullable(),
    diaVencimento: z.number().int().min(1).max(31).nullable(),
    atrasada: z.boolean(),
  })
  .refine((d) => d.credor || d.apelido, { message: "Diga com quem é a dívida." })
  .refine((d) => d.semParcela || d.parcelasAbertas == null || d.parcelasTotal == null || d.parcelasAbertas <= d.parcelasTotal, {
    message: "Faltam mais parcelas do que o total.",
  });

function revalidar() {
  revalidatePath("/dividas");
  // A seção "Dívidas por mês" das Recorrentes.
  revalidatePath("/orcamento/contas");
}

export async function salvarDividaAction(input: z.input<typeof dividaSchema>): Promise<{ ok: true } | { ok: false; erro: string }> {
  const r = dividaSchema.safeParse(input);
  if (!r.success) return { ok: false, erro: r.error.issues[0]?.message ?? "Confira os campos." };
  const { id, ...d } = r.data;
  const semParcela = d.semParcela;
  const dados = { ...d, parcelasAbertas: semParcela ? null : d.parcelasAbertas, parcelasTotal: semParcela ? null : d.parcelasTotal };
  const ctx = await getRequiredSession();
  if (id) await editarDivida(ctx, id, dados);
  else await criarDivida(ctx, dados);
  revalidar();
  return { ok: true };
}

export async function pagarParcelaAction(id: string): Promise<{ antes: AntesDoToque; quitada: boolean } | null> {
  const ctx = await getRequiredSession();
  const r = await pagarParcela(ctx, z.string().min(1).parse(id));
  revalidar();
  return r;
}

export async function quitarDividaAction(id: string) {
  const ctx = await getRequiredSession();
  await quitarDivida(ctx, z.string().min(1).parse(id));
  revalidar();
}

const antesSchema = z.object({ saldo: z.number().min(0), parcelasAbertas: z.number().int().min(0).nullable(), quitada: z.boolean() });

export async function desfazerAction(id: string, antes: AntesDoToque) {
  const ctx = await getRequiredSession();
  await desfazerToque(ctx, z.string().min(1).parse(id), antesSchema.parse(antes));
  revalidar();
}

/** Apagar pelo menu "…": só a dívida (ela não tem pagamentos ligados). Devolve o recibo do Desfazer. */
export async function apagarDividaAction(id: string): Promise<{ ok: true; desfazer: string | null } | { ok: false; erro: string }> {
  const ctx = await getRequiredSession();
  const apagada = await apagarDivida(ctx, z.string().min(1).max(60).parse(id));
  if (!apagada) return { ok: false, erro: "Essa dívida não existe mais. Recarregue a página." };
  revalidar();
  return { ok: true, desfazer: criarRecibo("divida", doDono(ctx), apagada) };
}

/** "Desfazer" no aviso: a mesma dívida volta, no mesmo lugar da lista. */
export async function desfazerApagarDividaAction(recibo: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const ctx = await getRequiredSession();
  const apagada = lerRecibo<DividaApagada>("divida", doDono(ctx), recibo);
  if (!apagada) return { ok: false, erro: "Não deu para desfazer. O tempo passou." };
  if (!(await restaurarDivida(ctx, apagada))) return { ok: false, erro: "Não deu para desfazer." };
  revalidar();
  return { ok: true };
}


const metaSchema = z.object({ total: z.number().positive().max(100_000_000), meses: z.number().int().min(1).max(600), ano: z.number().int().min(2000).max(2200), mes: z.number().int().min(1).max(12) });

/**
 * "Virar meta": a meta "Sair das dívidas" com o total das dívidas para resolver e a data do plano.
 * Se ela já tem essa meta, não cria outra.
 */
export async function virarMetaAction(input: z.input<typeof metaSchema>): Promise<{ ok: true; jaExistia: boolean } | { ok: false; erro: string }> {
  const r = metaSchema.safeParse(input);
  if (!r.success) return { ok: false, erro: "Ajuste o valor a mais até o plano fechar." };
  const ctx = await getRequiredSession();
  const nome = "Sair das dívidas";
  const ja = await prisma.goal.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId, name: nome }, select: { id: true } });
  if (ja) return { ok: true, jaExistia: true };
  await createGoal(ctx, {
    name: nome,
    targetAmount: r.data.total,
    // Meio-dia do dia 1, como as outras metas: meia-noite UTC é o dia 31 do mês anterior no
    // horário de Brasília, e a meta mostrava "ago/2027" para um plano que acaba em set/2027.
    targetDate: new Date(r.data.ano, r.data.mes - 1, 1, 12),
    currentAmount: 0,
    // Dinheiro que vai para dívida não rende: a meta conta sem juros.
    annualRate: 0,
    icon: "GENERICO",
  });
  revalidatePath("/planejamento/metas");
  return { ok: true, jaExistia: false };
}
