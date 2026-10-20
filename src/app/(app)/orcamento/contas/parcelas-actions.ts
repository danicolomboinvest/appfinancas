"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession, doDono } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { criarRecibo, lerRecibo } from "@/lib/desfazer/recibo";
import { apagarCompraParcelada, desfazerMudancaDaParcela, editarParcela, naoEParcela, type MudancaDaParcela } from "@/lib/repositories/parcelas.repo";
import { MAIOR_VALOR } from "@/lib/dinheiro/digitado";

/**
 * O menu "…" das parcelas de Recorrentes (13/10/2026): Editar, Apagar esta compra e Não é parcela,
 * cada um com o "Desfazer" no aviso (o mesmo recibo assinado de metas e dívidas). O mês é sempre o
 * de hoje, no servidor: a tela só diz qual parcela.
 */

type Resultado = { ok: true; desfazer: string | null } | { ok: false; erro: string };

const RECIBO = "parcela";
const SUMIU = "Essa parcela mudou. Recarregue a página.";

function revalidar() {
  // Renda com dono, o gasto da semana, Transações e os meses: tudo lê os mesmos lançamentos.
  revalidatePath("/", "layout");
}

function mesDeHoje() {
  const agora = nowInBrazil();
  return { year: agora.getFullYear(), month: agora.getMonth() + 1 };
}

const chaveSchema = z.string().min(1).max(200);

const edicaoSchema = z
  .object({
    valor: z.number({ message: "Diga o valor da parcela." }).positive("Diga o valor da parcela.").max(MAIOR_VALOR),
    atual: z.number().int().min(1).max(48),
    total: z.number().int().min(2, "Parcela é de 2 vezes para cima.").max(48, "Até 48 vezes."),
    dia: z.number().int().min(1).max(31).nullable(),
    categoria: z.enum(["MORADIA", "ALIMENTACAO", "TRANSPORTE", "SAUDE", "LAZER", "EDUCACAO", "OUTROS", "IMPOSTOS"]).nullable(),
  })
  .refine((e) => e.atual <= e.total, { message: "A parcela deste mês passa do total." });

function comRecibo(ctx: Awaited<ReturnType<typeof getRequiredSession>>, m: MudancaDaParcela): Resultado {
  revalidar();
  return { ok: true, desfazer: criarRecibo(RECIBO, doDono(ctx), m) };
}

export async function editarParcelaAction(chave: string, dados: z.input<typeof edicaoSchema>): Promise<Resultado> {
  const e = edicaoSchema.safeParse(dados);
  if (!e.success) return { ok: false, erro: e.error.issues[0]?.message ?? "Confira os campos." };
  const ctx = await getRequiredSession();
  const m = await editarParcela(ctx, mesDeHoje(), chaveSchema.parse(chave), e.data);
  return m ? comRecibo(ctx, m) : { ok: false, erro: SUMIU };
}

export async function apagarCompraAction(chave: string, tambemAsQuePassaram: boolean): Promise<Resultado> {
  const ctx = await getRequiredSession();
  const m = await apagarCompraParcelada(ctx, mesDeHoje(), chaveSchema.parse(chave), tambemAsQuePassaram === true);
  return m ? comRecibo(ctx, m) : { ok: false, erro: SUMIU };
}

export async function naoEParcelaAction(chave: string): Promise<Resultado> {
  const ctx = await getRequiredSession();
  const m = await naoEParcela(ctx, mesDeHoje(), chaveSchema.parse(chave));
  return m ? comRecibo(ctx, m) : { ok: false, erro: SUMIU };
}

export async function desfazerParcelaAction(recibo: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const ctx = await getRequiredSession();
  const m = lerRecibo<MudancaDaParcela>(RECIBO, doDono(ctx), recibo);
  if (!m) return { ok: false, erro: "Não deu para desfazer. O tempo passou." };
  await desfazerMudancaDaParcela(ctx, m);
  revalidar();
  return { ok: true };
}
