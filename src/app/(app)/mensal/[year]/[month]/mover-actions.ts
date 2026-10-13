"use server";

import { revalidatePath } from "next/cache";
import type { ProfileKind } from "@prisma/client";
import { getRequiredSession, type AuthContext } from "@/lib/auth/session";
import { chaveDoTema } from "@/lib/profiles/themes";
import { agendarCacaDoDinheiroPerdido } from "@/lib/dinheiro-perdido/agendar";
import { agendarContasDoHistorico } from "@/lib/contas/agendar-contas";
import { agendarAvisoDoCartao } from "@/lib/cartao/agendar";
import {
  comerciantesDosLancamentos,
  desfazerMudanca,
  moverLancamentos,
  outrasParcelas,
  perfisDeDestino,
  type LinhaMovida,
  type PerfilDestino,
} from "@/lib/repositories/mover-perfil.repo";

/**
 * "Enviar para outro perfil" (12/10/2026): a compra da Empresa que caiu no cartão Pessoal, já
 * importada, vai para a Empresa. Ver lib/repositories/mover-perfil.repo.ts.
 */

const idsValidos = (ids: unknown): string[] =>
  Array.isArray(ids) ? [...new Set(ids.filter((i): i is string => typeof i === "string" && i.length > 0 && i.length <= 40))].slice(0, 500) : [];

/** Os outros perfis dela. Vazio = a opção não aparece (um perfil só, ou o par do Casal). */
export async function perfisDeDestinoAction(): Promise<PerfilDestino[]> {
  const ctx = await getRequiredSession();
  return perfisDeDestino(ctx);
}

/** Antes de confirmar: as outras parcelas da mesma compra e os comerciantes que dá para lembrar. */
export async function prepararEnvioAction(ids: string[]): Promise<{ parcelas: string[]; comerciantes: string[] }> {
  const ctx = await getRequiredSession();
  const escolhidos = idsValidos(ids);
  const [parcelas, comerciantes] = await Promise.all([outrasParcelas(ctx, escolhidos), comerciantesDosLancamentos(ctx, escolhidos)]);
  return { parcelas, comerciantes };
}

/**
 * Tudo que é calculado a partir dos lançamentos recalcula nos DOIS perfis: as telas (orçamento,
 * resumo, acerto do casal) leem na hora e só precisam ser revalidadas; o Dinheiro perdido, as
 * contas do histórico e o aviso do limite do cartão rodam depois da resposta.
 */
async function recalcular(ctx: AuthContext, outro: { id: string; kind: ProfileKind; theme: string }, meses: { year: number; month: number }[]) {
  revalidatePath("/", "layout");
  const destino: AuthContext = { ...ctx, profileId: outro.id, profileKind: outro.kind, profileTheme: chaveDoTema(outro.theme), categorias: undefined };
  for (const c of [ctx, destino]) {
    if (c.profileKind !== "EMPRESA") await agendarCacaDoDinheiroPerdido(c);
    await agendarContasDoHistorico(c);
    for (const m of meses.slice(0, 24)) await agendarAvisoDoCartao(c, m.year, m.month);
  }
}

export async function enviarParaPerfilAction(input: { ids: string[]; destinoId: string; lembrar: boolean }): Promise<
  | { ok: true; movidos: number; ficaram: number; destino: { id: string; name: string; kind: ProfileKind }; desfazer: { destinoId: string; linhas: LinhaMovida[]; regras: string[] } }
  | { ok: false; erro: string }
> {
  const ctx = await getRequiredSession();
  if (ctx.par) return { ok: false, erro: "Só a dona do perfil pode mover lançamentos." };
  const r = await moverLancamentos(ctx, { ids: idsValidos(input.ids), destinoId: String(input.destinoId ?? ""), lembrar: input.lembrar === true });
  if (!r.ok) return r;
  await recalcular(ctx, r.destino, r.meses);
  return { ok: true, movidos: r.movidos, ficaram: r.ficaram, destino: { id: r.destino.id, name: r.destino.name, kind: r.destino.kind }, desfazer: r.desfazer };
}

export async function desfazerEnvioAction(dados: { destinoId: string; linhas: LinhaMovida[]; regras: string[] }): Promise<{ ok: boolean; voltaram: number }> {
  const ctx = await getRequiredSession();
  if (ctx.par) return { ok: false, voltaram: 0 };
  const perfis = await perfisDeDestino(ctx);
  const outro = perfis.find((p) => p.id === dados?.destinoId);
  if (!outro) return { ok: false, voltaram: 0 };
  const r = await desfazerMudanca(ctx, dados);
  if (r.voltaram > 0) await recalcular(ctx, outro, r.meses);
  return { ok: r.ok, voltaram: r.voltaram };
}
