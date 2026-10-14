"use server";

import { reaisDoCampo } from "@/lib/dinheiro/digitado";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession, type AuthContext } from "@/lib/auth/session";
import { ehCasal } from "@/lib/profiles/casal";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { ehCanal, limparNomeDoPar, NOME_GENERICO_DO_PAR } from "@/lib/casal-login/regras";
import {
  ErroDoConvite,
  cancelarConvite,
  criarConvite,
  definirMostrarRenda,
  registrarEnvio,
  removerPar,
  sairDoCasal,
  situacaoDoParAgora,
} from "@/lib/repositories/casal-login.repo";
import { sairDaCasa } from "@/lib/repositories/casa.repo";
import { apagarNoCasal, conferirMes, criarMetaDoCasal, editarNoCasal, lancarNoCasal, letraDeQuemOlha, type Destino, type NovoLancamentoDoCasal } from "@/lib/repositories/nos-dois.repo";

export type Resposta<T = object> = ({ ok: true } & T) | { ok: false; mensagem: string };

/** A URL do app de onde veio o pedido: no iPhone (Capacitor) e no navegador é o mesmo domínio. */
async function urlDoApp(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

async function contextoDoCasal(): Promise<AuthContext> {
  const ctx = await getRequiredSession();
  if (!ehCasal(ctx.profileKind)) throw new ErroDoConvite("Isso é só do Nós dois.");
  // O par só mexe enquanto o Casal da titular valer (as telas já estão fechadas para ele).
  if (ctx.par && (await situacaoDoParAgora(ctx.par)).tipo !== "liberado") throw new ErroDoConvite("O Nós dois está pausado.");
  return ctx;
}

async function responder<T extends object>(fn: () => Promise<T>, revalidar = true): Promise<Resposta<T>> {
  try {
    const r = await fn();
    if (revalidar) revalidatePath("/divisao");
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ErroDoConvite) return { ok: false, mensagem: e.message };
    console.error("[nos-dois]", e);
    return { ok: false, mensagem: "Não consegui agora. Tente de novo." };
  }
}

// --- Convite (titular) ---------------------------------------------------------------------------

/** Cria o convite (ou troca o anterior, no "Mandar de novo"). O link só existe nesta resposta. */
export async function criarConviteAction(nome: string): Promise<Resposta<{ link: string; expiraEm: string; nomePar: string }>> {
  return responder(async () => {
    const ctx = await contextoDoCasal();
    const nomePar = limparNomeDoPar(nome) || NOME_GENERICO_DO_PAR;
    const { token, expiraEm } = await criarConvite(ctx, nomePar);
    return { link: `${await urlDoApp()}/par/${token}`, expiraEm: expiraEm.toISOString(), nomePar };
    // Sem recarregar a tela agora: a folha está aberta mostrando o link. Ela recarrega ao fechar.
  }, false);
}

export async function registrarEnvioAction(canal: string, nome: string): Promise<Resposta> {
  return responder(async () => {
    if (!ehCanal(canal)) throw new ErroDoConvite("Canal inválido.");
    const ctx = await contextoDoCasal();
    await registrarEnvio(ctx, canal, limparNomeDoPar(nome) || null);
    return {};
  }, false);
}

export async function cancelarConviteAction(): Promise<Resposta> {
  return responder(async () => {
    const ctx = await contextoDoCasal();
    await cancelarConvite(ctx);
    return {};
  });
}

export async function removerParAction(): Promise<Resposta> {
  return responder(async () => {
    // Casal simples: a titular tira o par da casa (Configurações › Casa).
    const daSessao = await getRequiredSession();
    if (daSessao.casa) {
      if ((await sairDaCasa(daSessao, "titular")) === 0) throw new ErroDoConvite("Só quem paga o Casal tira o par.");
      revalidatePath("/", "layout");
      return {};
    }
    const ctx = await contextoDoCasal();
    await removerPar(ctx);
    revalidatePath("/configuracoes/nos-dois");
    return {};
  });
}

export async function mostrarRendaAction(mostrar: boolean): Promise<Resposta> {
  return responder(async () => {
    const ctx = await contextoDoCasal();
    await definirMostrarRenda(ctx, mostrar === true);
    revalidatePath("/configuracoes/nos-dois");
    return {};
  });
}

// --- Par ---------------------------------------------------------------------------------------

export async function sairDoCasalAction(): Promise<Resposta> {
  try {
    const ctx = await getRequiredSession();
    // Casal simples: o par sai da casa e fica com o Pessoal dele.
    if (ctx.casa) {
      if ((await sairDaCasa(ctx, "par")) === 0) throw new ErroDoConvite("Quem paga o Casal tira o par em Remover.");
    } else await sairDoCasal(ctx);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof ErroDoConvite) return { ok: false, mensagem: e.message };
    console.error("[nos-dois] sair", e);
    return { ok: false, mensagem: "Não consegui agora. Tente de novo." };
  }
}

// --- Os dois -------------------------------------------------------------------------------------

function lerLancamento(d: Record<string, unknown>): NovoLancamentoDoCasal {
  const categoria = d.categoria === "INCOME" ? "INCOME" : "EXPENSE";
  const valor = reaisDoCampo(String(d.valor ?? "")) ?? NaN;
  if (!Number.isFinite(valor) || valor <= 0 || valor > 10_000_000) throw new ErroDoConvite("Digite um valor maior que zero.");
  const destino: Destino = d.destino === "so-meu" || d.destino === "da-pessoa" ? d.destino : "nosso";
  const pc = typeof d.parentCategory === "string" && (PARENT_CATEGORIES as string[]).includes(d.parentCategory) ? (d.parentCategory as ParentCategory) : null;
  const diaTxt = typeof d.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.dia) ? d.dia : new Date().toISOString().slice(0, 10);
  return { categoria, valor, descricao: String(d.descricao ?? "").trim().slice(0, 120), parentCategory: pc, dia: new Date(`${diaTxt}T12:00:00Z`), destino };
}

export async function lancarNoCasalAction(dados: Record<string, unknown>): Promise<Resposta> {
  return responder(async () => {
    const ctx = await contextoDoCasal();
    const l = lerLancamento(dados);
    await lancarNoCasal(ctx, l, await letraDeQuemOlha(ctx));
    revalidatePath("/mensal", "layout");
    return {};
  });
}

export async function editarNoCasalAction(id: string, dados: Record<string, unknown>): Promise<Resposta> {
  return responder(async () => {
    const ctx = await contextoDoCasal();
    const n = await editarNoCasal(ctx, String(id), lerLancamento(dados));
    if (n === 0) throw new ErroDoConvite("Você só muda o que você lançou.");
    revalidatePath("/mensal", "layout");
    return {};
  });
}

export async function apagarNoCasalAction(id: string): Promise<Resposta> {
  return responder(async () => {
    const ctx = await contextoDoCasal();
    const n = await apagarNoCasal(ctx, String(id));
    if (n === 0) throw new ErroDoConvite("Você só apaga o que você lançou.");
    revalidatePath("/mensal", "layout");
    return {};
  });
}

export async function conferirMesAction(ano: number, mes: number): Promise<Resposta> {
  return responder(async () => {
    if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) throw new ErroDoConvite("Mês inválido.");
    const ctx = await contextoDoCasal();
    await conferirMes(ctx, ano, mes, await letraDeQuemOlha(ctx));
    return {};
  });
}

export async function criarMetaDoCasalAction(dados: { nome: string; alvo: string; ate: string }): Promise<Resposta> {
  return responder(async () => {
    const ctx = await contextoDoCasal();
    const nome = String(dados.nome ?? "").trim().slice(0, 40);
    if (!nome) throw new ErroDoConvite("Dê um nome para a meta.");
    const alvo = reaisDoCampo(String(dados.alvo ?? "")) ?? NaN;
    if (!Number.isFinite(alvo) || alvo <= 0) throw new ErroDoConvite("Quanto vocês querem juntar?");
    const ate = /^\d{4}-\d{2}$/.test(String(dados.ate ?? "")) ? new Date(`${dados.ate}-01T12:00:00Z`) : null;
    await criarMetaDoCasal(ctx, { nome, alvo, ate });
    return {};
  });
}
