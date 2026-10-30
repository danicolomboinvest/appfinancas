"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { GoalIcon } from "@prisma/client";
import { getRequiredSession, doDono } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { createMonthlyEntry } from "@/lib/repositories/monthly-entry.repo";
import { apagarMeta, restaurarMeta, type MetaApagada } from "@/lib/repositories/goal.repo";
import { criarRecibo, lerRecibo } from "@/lib/desfazer/recibo";
import { lerMetaDaTela } from "@/lib/repositories/metas.repo";
import { getDiaInicioMes } from "@/lib/repositories/user.repo";
import { mesDoPeriodo } from "@/lib/mes/periodo";
import { criarRascunhoDaMeta } from "@/lib/repositories/plano-da-meta.repo";
import { TAXA_PADRAO_DAS_METAS, mesDaqui, mesDoAporte, porMesDaNovaMeta } from "@/lib/metas/projecao";
import { TIPOS_DE_META, ehFotoDoBanco, FOTOS_DE_META, urlDaFoto } from "@/lib/metas/tipos";

/**
 * As ações da área Metas da versão nova: criar e editar pela nova meta guiada, guardar e retirar,
 * o aporte do mês ("Já fiz", "Ainda não", "Foi para esta meta?") e o "Voltar ao ritmo". Toda conta
 * de dinheiro é refeita aqui no servidor; o que vem da tela é só a escolha dela.
 */

type Resultado = { ok: true } | { ok: false; error: string };

function revalidarMetas(id?: string) {
  revalidatePath("/planejamento/metas");
  if (id) revalidatePath(`/planejamento/metas/${id}`);
  revalidatePath("/mensal/foco");
  revalidatePath("/decidir");
}

const CHAVES_DE_TIPO = TIPOS_DE_META.map((t) => t.chave) as [GoalIcon, ...GoalIcon[]];
const FOTOS_DO_BANCO = new Set(FOTOS_DE_META.map((f) => urlDaFoto(f.arquivo)));

/** A foto só pode ser uma do banco do app ou uma que ela mesma enviou (do próprio perfil). */
async function fotoValida(ctx: Awaited<ReturnType<typeof getRequiredSession>>, foto: string | null): Promise<string | null> {
  if (!foto) return null;
  if (ehFotoDoBanco(foto)) return FOTOS_DO_BANCO.has(foto) ? foto : null;
  const m = /^\/api\/metas\/foto\/([a-z0-9]{10,40})$/.exec(foto);
  if (!m) return null;
  const existe = await prisma.fotoDaMeta.count({ where: { id: m[1], ...doDono(ctx) } });
  return existe ? foto : null;
}

const metaGuiadaSchema = z.object({
  nome: z.string().trim().min(1, "Diga para que é a meta.").max(60),
  tipo: z.enum(CHAVES_DE_TIPO),
  alvo: z.number().positive("Digite um valor").max(1e10),
  /** "2027-10" ou nulo (sem prazo). */
  prazo: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable(),
  /** Só vale sem prazo: quanto ela quer guardar por mês. Com prazo, o servidor calcula. */
  porMes: z.number().min(0).max(1e9),
  foto: z.string().max(200).nullable(),
});

export type MetaGuiada = z.infer<typeof metaGuiadaSchema>;

function prazoValido(prazo: string | null, hoje: Date): Date | null | "invalido" {
  if (!prazo) return null;
  const [a, m] = prazo.split("-").map(Number);
  if (m < 1 || m > 12 || a > 2080) return "invalido";
  // Mês de hoje ou antes: não dá para chegar "ontem".
  if (a * 12 + m <= hoje.getFullYear() * 12 + hoje.getMonth() + 1) return "invalido";
  return new Date(a, m - 1, 1, 12);
}

/** Nova meta guiada: nome, tipo, quanto, quando, foto. O valor por mês sai da conta (ou da escolha, sem prazo). */
/**
 * "Como vou juntar?" na folha da nova meta (16/10/2026): a meta ainda NÃO nasce. Vira um rascunho e
 * o plano abre nele; ela nasce no "Usar esse plano" ou no "Criar a meta sem plano". Antes, a meta
 * nascia aqui e quem voltava e tentava de novo ficava com duas metas iguais (aconteceu com a Dani).
 */
export async function comecarPlanoDaNovaMetaAction(dados: MetaGuiada): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const p = metaGuiadaSchema.safeParse(dados);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  const prazo = prazoValido(p.data.prazo, hoje);
  if (prazo === "invalido") return { ok: false, error: "Escolha um mês daqui para frente." };
  if (!prazo) return { ok: false, error: "Escolha uma data para a meta." };
  const id = await criarRascunhoDaMeta(ctx, { nome: p.data.nome, tipo: p.data.tipo, alvo: p.data.alvo, prazo: `${prazo.getFullYear()}-${String(prazo.getMonth() + 1).padStart(2, "0")}`, foto: await fotoValida(ctx, p.data.foto) });
  return { ok: true, id };
}

export async function criarMetaAction(dados: MetaGuiada): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const p = metaGuiadaSchema.safeParse(dados);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  const prazo = prazoValido(p.data.prazo, hoje);
  if (prazo === "invalido") return { ok: false, error: "Escolha um mês daqui para frente." };
  const porMes = prazo ? porMesDaNovaMeta(p.data.alvo, prazo, hoje) : Math.max(50, Math.round(p.data.porMes));
  const meta = await prisma.goal.create({
    data: {
      ...doDono(ctx),
      name: p.data.nome,
      icon: p.data.tipo,
      targetAmount: p.data.alvo,
      targetDate: prazo,
      currentAmount: 0,
      annualRate: TAXA_PADRAO_DAS_METAS,
      monthlyContribution: porMes,
      status: "NOT_STARTED",
      fotoUrl: await fotoValida(ctx, p.data.foto),
    },
  });
  revalidarMetas();
  return { ok: true, id: meta.id };
}

/**
 * Editar pela mesma folha. O que já foi guardado e o rendimento continuam; o valor por mês
 * combinado é refeito pela conta quando há prazo (sem prazo, vale o que ela escolheu).
 */
export async function editarMetaAction(id: string, dados: MetaGuiada): Promise<Resultado> {
  const p = metaGuiadaSchema.safeParse(dados);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  const meta = await lerMetaDaTela(ctx, z.string().min(1).max(60).parse(id), hoje);
  if (!meta) return { ok: false, error: "Essa meta não existe mais. Recarregue a página." };
  const prazo = prazoValido(p.data.prazo, hoje);
  if (prazo === "invalido") return { ok: false, error: "Escolha um mês daqui para frente." };
  const porMes = prazo
    ? porMesDaNovaMeta(p.data.alvo, prazo, hoje, meta.taxaAnual, meta.guardado)
    : Math.max(50, Math.round(p.data.porMes));
  await prisma.goal.updateMany({
    where: { id: meta.id, ...doDono(ctx) },
    data: { name: p.data.nome, icon: p.data.tipo, targetAmount: p.data.alvo, targetDate: prazo, monthlyContribution: porMes, fotoUrl: await fotoValida(ctx, p.data.foto) },
  });
  revalidarMetas(meta.id);
  return { ok: true };
}

/**
 * Apagar pelo menu "…" (ou pela folha). Some só a meta: os aportes continuam nos meses e os
 * ativos na Carteira. Devolve o recibo do Desfazer (null quando o servidor não pode assinar).
 */
export async function apagarMetaAction(id: string): Promise<{ ok: true; desfazer: string | null } | { ok: false; error: string }> {
  const ctx = await getRequiredSession();
  const apagada = await apagarMeta(ctx, z.string().min(1).max(60).parse(id));
  if (!apagada) return { ok: false, error: "Essa meta não existe mais. Recarregue a página." };
  revalidarMetas(apagada.meta.id);
  revalidatePath("/carteira");
  return { ok: true, desfazer: criarRecibo("meta", doDono(ctx), apagada) };
}

/** "Desfazer" no aviso: a meta volta igual, com os aportes e ativos que eram dela. */
export async function desfazerApagarMetaAction(recibo: string): Promise<Resultado> {
  const ctx = await getRequiredSession();
  const apagada = lerRecibo<MetaApagada>("meta", doDono(ctx), recibo);
  if (!apagada) return { ok: false, error: "Não deu para desfazer. O tempo passou." };
  const ok = await restaurarMeta(ctx, apagada);
  if (!ok) return { ok: false, error: "Não deu para desfazer." };
  revalidarMetas(apagada.meta.id);
  revalidatePath("/carteira");
  return { ok: true };
}

const valorSchema = z.number().positive("Digite um valor").max(1e10);

/** "Adicionar" e o "−" (retirar) da barra do detalhe: um aporte (ou resgate) neste mês, hoje. */
export async function guardarNaMetaAction(id: string, valor: number, tipo: "adicionar" | "retirar"): Promise<Resultado> {
  const v = valorSchema.safeParse(valor);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Valor inválido." };
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  const meta = await lerMetaDaTela(ctx, z.string().min(1).max(60).parse(id), hoje);
  if (!meta) return { ok: false, error: "Essa meta não existe mais. Recarregue a página." };
  if (tipo === "retirar" && v.data > meta.guardado + 0.005) return { ok: false, error: "É mais do que tem na meta." };
  // O mês do "Guardei" é o da pessoa (30/10/2026), como o lançamento à mão.
  const mesDela = mesDoPeriodo(hoje, await getDiaInicioMes(ctx)) ?? { year: hoje.getFullYear(), month: hoje.getMonth() + 1 };
  await createMonthlyEntry(ctx, {
    year: mesDela.year,
    month: mesDela.month,
    category: "INVESTMENT_CONTRIBUTION",
    description: tipo === "adicionar" ? `Guardei: ${meta.nome}` : `Retirei: ${meta.nome}`,
    amount: tipo === "adicionar" ? v.data : -v.data,
    entryDate: new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())),
    goalId: meta.id,
  });
  revalidarMetas(meta.id);
  return { ok: true };
}

const ORIGENS = { pix: "Pix para você", aplicacao: "Aplicação", dinheiro: "Dinheiro" } as const;

/**
 * "Já fiz": o aporte do mês que ela marca à mão, com o valor, de onde saiu e o dia. O dia vai do
 * começo do mês do aporte (até o dia 7, o mês passado) até hoje, e o lançamento entra no mês do
 * dia. Quando a linha chegar no extrato, a importação concilia (±15%, ±7 dias) e não soma de novo.
 */
export async function marcarAporteAction(id: string, valor: number, origem: keyof typeof ORIGENS, dia: string): Promise<Resultado> {
  const v = valorSchema.safeParse(valor);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Valor inválido." };
  const o = z.enum(["pix", "aplicacao", "dinheiro"]).parse(origem);
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  const meta = await lerMetaDaTela(ctx, z.string().min(1).max(60).parse(id), hoje);
  if (!meta) return { ok: false, error: "Essa meta não existe mais. Recarregue a página." };
  const ref = mesDoAporte(hoje);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  const data = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  const inicio = new Date(ref.ano, ref.mes - 1, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (!data || Number.isNaN(data.getTime()) || data < inicio || data > fim) return { ok: false, error: `Escolha um dia entre 1º de ${ref.nome} e hoje.` };
  const mesDela = mesDoPeriodo(data, await getDiaInicioMes(ctx)) ?? { year: data.getFullYear(), month: data.getMonth() + 1 };
  await createMonthlyEntry(ctx, {
    year: mesDela.year,
    month: mesDela.month,
    category: "INVESTMENT_CONTRIBUTION",
    description: `${ORIGENS[o]} · ${meta.nome}`,
    amount: v.data,
    entryDate: new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate())),
    goalId: meta.id,
  });
  await prisma.goal.updateMany({ where: { id: meta.id, ...doDono(ctx) }, data: { checkinDismissedMonth: ref.chave, aporteAdiadoMes: null } });
  revalidarMetas(meta.id);
  return { ok: true };
}

/** "Ainda não": para de perguntar sobre este mês. */
export async function adiarAporteAction(id: string): Promise<Resultado> {
  const ctx = await getRequiredSession();
  const ref = mesDoAporte(nowInBrazil());
  await prisma.goal.updateMany({ where: { id: z.string().min(1).max(60).parse(id), ...doDono(ctx) }, data: { aporteAdiadoMes: ref.chave } });
  revalidarMetas(id);
  return { ok: true };
}

/** "Foi para esta meta?": Sim liga o lançamento à meta; Não guarda a recusa e não pergunta mais. */
export async function responderAporteAction(id: string, entradaId: string, foi: boolean): Promise<Resultado> {
  const ctx = await getRequiredSession();
  const goalId = z.string().min(1).max(60).parse(id);
  const entryId = z.string().min(1).max(60).parse(entradaId);
  const meta = await prisma.goal.findFirst({ where: { id: goalId, ...doDono(ctx) }, select: { id: true, aportesRecusados: true } });
  if (!meta) return { ok: false, error: "Essa meta não existe mais. Recarregue a página." };
  if (foi) {
    const r = await prisma.monthlyEntry.updateMany({ where: { id: entryId, ...doDono(ctx), goalId: null, category: "INVESTMENT_CONTRIBUTION" }, data: { goalId } });
    if (r.count === 0) return { ok: false, error: "Esse lançamento já foi ligado a outra meta." };
  } else if (!meta.aportesRecusados.includes(entryId)) {
    await prisma.goal.updateMany({ where: { id: goalId, ...doDono(ctx) }, data: { aportesRecusados: { push: entryId } } });
  }
  revalidarMetas(goalId);
  return { ok: true };
}

/** Voltar ao ritmo: guardar o que a conta pede por mês (refeita aqui), ou mudar o prazo para quando o ritmo chega. */
export async function voltarAoRitmoAction(id: string, jeito: "por-mes" | "prazo"): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  const meta = await lerMetaDaTela(ctx, z.string().min(1).max(60).parse(id), hoje);
  if (!meta) return { ok: false, error: "Essa meta não existe mais. Recarregue a página." };
  if (jeito === "por-mes") {
    await prisma.goal.updateMany({ where: { id: meta.id, ...doDono(ctx) }, data: { monthlyContribution: meta.plano.porMesNecessario } });
    revalidarMetas(meta.id);
    return { ok: true, texto: "Novo valor por mês combinado" };
  }
  if (!meta.plano.chegaPeloRitmo || meta.plano.chega === null) return { ok: false, error: "Ainda não há ritmo para calcular a data." };
  const novo = mesDaqui(hoje, meta.plano.chega);
  await prisma.goal.updateMany({ where: { id: meta.id, ...doDono(ctx) }, data: { targetDate: new Date(novo.ano, novo.mes - 1, 1, 12) } });
  revalidarMetas(meta.id);
  return { ok: true, texto: `Prazo trocado para ${novo.texto}` };
}

const TIPOS_DE_IMAGEM = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * "Usar uma minha": a foto já chega reduzida do aparelho (lado maior até 1280 px). Fica no banco,
 * presa à dona, e sai só pela rota autenticada. Nada vai para link público.
 */
export async function enviarFotoDaMetaAction(form: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const arquivo = form.get("foto");
  if (!(arquivo instanceof File)) return { ok: false, error: "Não recebi a foto." };
  if (!TIPOS_DE_IMAGEM.has(arquivo.type)) return { ok: false, error: "Use uma foto em JPG, PNG ou WebP." };
  if (arquivo.size > 3 * 1024 * 1024) return { ok: false, error: "A foto ficou grande demais. Tente outra." };
  const ctx = await getRequiredSession();
  const dados = Buffer.from(await arquivo.arrayBuffer());
  const foto = await prisma.fotoDaMeta.create({ data: { ...doDono(ctx), tipo: arquivo.type, dados } });
  return { ok: true, url: `/api/metas/foto/${foto.id}` };
}
