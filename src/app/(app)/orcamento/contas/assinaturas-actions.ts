"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { hojeEmBrasilia } from "@/lib/contas/contas";
import type { ComercianteParaEscolher } from "@/lib/contas/assinaturas";
import { adicionarDosLancamentos, escreverAssinatura, listarParaEscolher, recusarAssinatura, removerAssinatura, sugerirCategoria } from "@/lib/repositories/assinaturas.repo";

function revalidar() {
  revalidatePath("/orcamento", "layout");
  revalidatePath("/mensal/foco");
}

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
  await removerAssinatura(ctx, z.string().min(1).parse(id));
  revalidar();
}

/** "Não é assinatura" numa achada sozinha: some para sempre. */
export async function naoEAssinaturaAction(nome: string): Promise<void> {
  const ctx = await getRequiredSession();
  await recusarAssinatura(ctx, z.string().trim().min(1).max(80).parse(nome));
  revalidar();
}
