"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { hojeEmBrasilia } from "@/lib/contas/contas";
import { chaveDoComercianteDe, type ComercianteParaEscolher } from "@/lib/contas/assinaturas";
import { adicionarDosLancamentos, escreverAssinatura, listarAssinaturasDela, listarParaEscolher, removerAssinatura, sugerirCategoria } from "@/lib/repositories/assinaturas.repo";
import { desfazerAssinatura, responderAssinatura, revalidarAssinaturas } from "@/lib/assinaturas/respostas";

/**
 * Toda resposta sobre assinatura aqui passa pela regra única (lib/assinaturas, 15/10/2026): o
 * "+ Adicionar", o "Não é assinatura" e o "Remover" valem também no Raio-X e no Dinheiro perdido.
 */
function revalidar() {
  revalidatePath("/orcamento", "layout");
  revalidarAssinaturas();
}

const marcasSchema = z.array(z.string().min(3).max(120)).max(12);

/** "Escolher dos meus lançamentos": um item por comerciante, dos últimos 3 meses. */
export async function listarParaEscolherAction(): Promise<ComercianteParaEscolher[]> {
  const ctx = await getRequiredSession();
  return listarParaEscolher(ctx, hojeEmBrasilia());
}

export async function adicionarDosLancamentosAction(chave: string): Promise<{ ok: true; nome: string } | { ok: false }> {
  const c = z.string().min(1).max(160).safeParse(chave);
  if (!c.success) return { ok: false };
  const ctx = await getRequiredSession();
  const r = await adicionarDosLancamentos(ctx, c.data, hojeEmBrasilia());
  if (!r) return { ok: false };
  await responderAssinatura(ctx, { comerciante: c.data, nome: r.nome }, "lista_adicionar");
  revalidar();
  return { ok: true, nome: r.nome };
}

const escritaSchema = z.object({
  id: z.string().min(1).optional(),
  nome: z.string().trim().min(1, "Escreva o nome.").max(80),
  valor: z.number({ message: "Diga quanto é por mês." }).positive("Diga quanto é por mês.").transform((v) => Math.min(v, 10_000_000)),
  dia: z.number().int().min(1).max(31).nullable(),
  categoria: z.enum(["MORADIA", "ALIMENTACAO", "TRANSPORTE", "SAUDE", "LAZER", "EDUCACAO", "OUTROS", "IMPOSTOS"]).nullable(),
});

export async function escreverAssinaturaAction(input: z.input<typeof escritaSchema>): Promise<{ ok: true } | { ok: false; erro: string }> {
  const r = escritaSchema.safeParse(input);
  if (!r.success) return { ok: false, erro: r.error.issues[0]?.message ?? "Confira os campos." };
  const ctx = await getRequiredSession();
  const { id, ...d } = r.data;
  const feito = await escreverAssinatura(ctx, d, hojeEmBrasilia(), id);
  if (!feito) return { ok: false, erro: "Não achei essa assinatura." };
  // Escrever uma nova é dizer "isto é assinatura" (editar a que já está na lista não muda nada).
  if (!id) {
    const salva = (await listarAssinaturasDela(ctx)).find((a) => a.id === feito.id);
    await responderAssinatura(ctx, { comerciante: salva?.chaveDoHistorico ?? chaveDoComercianteDe(d.nome), nome: d.nome }, "lista_adicionar");
  }
  revalidar();
  return { ok: true };
}

/** A categoria que o motor sugere para o nome escrito. */
export async function sugerirCategoriaAction(nome: string): Promise<string | null> {
  const n = z.string().trim().min(2).max(80).safeParse(nome);
  if (!n.success) return null;
  const ctx = await getRequiredSession();
  return sugerirCategoria(ctx, n.data);
}

export async function removerAssinaturaAction(id: string): Promise<void> {
  const ctx = await getRequiredSession();
  const i = z.string().min(1).parse(id);
  const antes = (await listarAssinaturasDela(ctx)).find((a) => a.id === i);
  if (await removerAssinatura(ctx, i)) {
    if (antes) await responderAssinatura(ctx, { comerciante: antes.chaveDoHistorico, nome: antes.nome }, "lista_remover");
  }
  revalidar();
}

const naoESchema = z.object({ nome: z.string().trim().min(1).max(80), marcas: marcasSchema.optional() });

/** "Não é assinatura" numa achada sozinha: sai da lista, do Raio-X e das cartas de assinatura. */
export async function naoEAssinaturaAction(input: z.input<typeof naoESchema>): Promise<void> {
  const d = naoESchema.parse(input);
  const ctx = await getRequiredSession();
  await responderAssinatura(ctx, { nome: d.nome, marcas: d.marcas }, "lista_nao_e");
  revalidar();
}

/** Desfazer o "Não é assinatura": volta a resposta de antes (de qualquer tela), em todo lugar. */
export async function desfazerNaoEAssinaturaAction(input: z.input<typeof naoESchema>): Promise<void> {
  const d = naoESchema.parse(input);
  const ctx = await getRequiredSession();
  await desfazerAssinatura(ctx, { nome: d.nome, marcas: d.marcas });
  revalidar();
}
