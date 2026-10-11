"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { compraDoApp } from "@/lib/assinatura/compra";
import { dataLonga, renovacaoEm } from "@/lib/assinatura/renovacao";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { SUPORTE_EMAIL } from "@/app/(app)/configuracoes/_ajustes/suporte";
import { AREAS, dentroDoReembolso, diaDoAviso, diaDoLembreteDoReembolso, MESES_GRATIS, ofertaDisponivel, PEDIDO_DO_MOTIVO, type TipoDePedido } from "./regras";

const motivoSchema = z.enum(["caro", "dificil", "errado", "naouso", "outro", "sem_motivo"]);

/** Guarda cada escolha de quem abriu o cancelar, para medir (o motivo e o que ela fez). */
export async function registrarMotivoAction(input: { motivo: string; escolha: string; texto?: string }): Promise<void> {
  const r = z.object({ motivo: motivoSchema, escolha: z.enum(["aceitou_oferta", "foi_cancelar", "abriu_hubla", "abriu_apple"]), texto: z.string().trim().max(2000).optional() }).safeParse(input);
  if (!r.success) return;
  const ctx = await getRequiredSession();
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true } });
  const compra = user ? await compraDoApp(ctx.userId, user.email) : null;
  await prisma.motivoDeCancelamento.create({ data: { userId: ctx.userId, motivo: r.data.motivo, escolha: r.data.escolha, via: compra?.via ?? "site", texto: r.data.texto || null } });
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const ASSUNTO: Record<TipoDePedido, string> = {
  meses_gratis: `Antes de cancelar: ${MESES_GRATIS} meses grátis`,
  duvida: "Antes de cancelar: dúvida",
  contestacao: "Antes de cancelar: número errado (corrigir em até 48 horas)",
  aviso_renovacao: "Antes de cancelar: aviso antes da renovação",
  conversa: "Antes de cancelar: quer falar com a equipe",
  aviso_reembolso: "Antes de cancelar: lembrete do prazo de reembolso",
};

export type ResultadoDoPedido = { ok: true; avisarEm?: string } | { ok: false; erro: string };

/**
 * A pessoa aceitou a ajuda do motivo. Vira um pedido para a equipe (tabela + e-mail para o app@,
 * com resposta para o e-mail dela). Cada tipo, uma vez a cada 12 meses. Os meses grátis só para
 * quem pagou no site (a Hubla adia a cobrança; na Apple seria outra coisa).
 */
export async function pedirAntesDeCancelarAction(input: { motivo: string; texto?: string; area?: string }): Promise<ResultadoDoPedido> {
  const r = z
    .object({ motivo: z.enum(["caro", "dificil", "errado", "naouso", "outro"]), texto: z.string().trim().max(4000).optional(), area: z.enum(AREAS).optional() })
    .safeParse(input);
  if (!r.success) return { ok: false, erro: "Confira o que foi escrito." };
  const { motivo, texto, area } = r.data;
  const tipo = PEDIDO_DO_MOTIVO[motivo];
  if ((tipo === "duvida" || tipo === "contestacao") && !texto) return { ok: false, erro: "Escreva ou grave o que aconteceu." };

  const ctx = await getRequiredSession();
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true, name: true } });
  if (!user) return { ok: false, erro: "Não achei a sua conta." };
  const compra = await compraDoApp(ctx.userId, user.email);
  if (!compra || compra.via !== "site") return { ok: false, erro: "Esta ajuda vale para quem pagou pelo site." };

  const ultimo = await prisma.pedidoAntesDeCancelar.findFirst({ where: { userId: ctx.userId, tipo }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const agora = new Date();
  if (!ofertaDisponivel(ultimo?.createdAt ?? null, agora)) return { ok: false, erro: "Você já usou esta ajuda nos últimos 12 meses." };

  const renova = renovacaoEm(compra.em, nowInBrazil());
  const avisarEm = tipo === "aviso_renovacao" ? diaDoAviso(renova) : null;
  await prisma.pedidoAntesDeCancelar.create({ data: { userId: ctx.userId, tipo, texto: texto || null, area: area ?? null, avisarEm } });
  await prisma.motivoDeCancelamento.create({ data: { userId: ctx.userId, motivo, escolha: "aceitou_oferta", via: "site", texto: motivo === "outro" ? texto || null : null } });

  // Para a equipe. Sem SMTP (local), o envio só registra no log e não sai nada.
  const linhas = [
    `<p><b>${escapar(ASSUNTO[tipo])}</b></p>`,
    `<p>${escapar(user.name ?? "")} (${escapar(user.email)}), pagou pelo site. Renova em ${dataLonga(renova)}.</p>`,
    tipo === "meses_gratis" ? `<p>Somar ${MESES_GRATIS} meses: Hubla, painel de assinaturas, adicionar os dias; e Admin › Acessos, o mesmo e-mail, novo prazo. Depois, marcar Feito em /admin/pedidos.</p>` : "",
    area ? `<p>Onde: ${escapar(area)}</p>` : "",
    texto ? `<p>${escapar(texto).replace(/\n/g, "<br>")}</p>` : "",
    avisarEm ? `<p>O aviso sai sozinho em ${dataLonga(avisarEm)}.</p>` : "",
  ].join("");
  if (tipo !== "aviso_renovacao") await sendEmail({ to: SUPORTE_EMAIL, subject: `${ASSUNTO[tipo]} · ${user.email}`, html: linhas, replyTo: user.email });

  revalidatePath("/configuracoes");
  revalidatePath("/admin/pedidos");
  return { ok: true, ...(avisarEm ? { avisarEm: avisarEm.toISOString().slice(0, 10) } : {}) };
}

/** /admin/pedidos: a equipe marca o pedido como feito. */
export async function marcarPedidoFeitoAction(id: string): Promise<{ ok: boolean }> {
  const ctx = await requireAdmin();
  const v = z.string().min(1).safeParse(id);
  if (!v.success) return { ok: false };
  const admin = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true } });
  await prisma.pedidoAntesDeCancelar.update({ where: { id: v.data }, data: { estado: "feito", feitoEm: new Date(), feitoPor: admin?.email ?? null } });
  revalidatePath("/admin/pedidos");
  return { ok: true };
}

/**
 * "Me avisa" do cartão dos 7 dias: um e-mail 1 dia antes de o prazo do reembolso acabar (sai pelo
 * cron de avisos). Só dentro dos 7 dias e para quem pagou no site.
 */
export async function lembrarReembolsoAction(): Promise<ResultadoDoPedido> {
  const ctx = await getRequiredSession();
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true } });
  const compra = user ? await compraDoApp(ctx.userId, user.email) : null;
  if (!compra || compra.via !== "site" || !dentroDoReembolso(compra.em, nowInBrazil())) return { ok: false, erro: "O prazo do reembolso já passou." };
  const avisarEm = diaDoLembreteDoReembolso(compra.em);
  const ja = await prisma.pedidoAntesDeCancelar.findFirst({ where: { userId: ctx.userId, tipo: "aviso_reembolso", estado: "aberto" }, select: { id: true } });
  if (!ja) await prisma.pedidoAntesDeCancelar.create({ data: { userId: ctx.userId, tipo: "aviso_reembolso", avisarEm } });
  await prisma.motivoDeCancelamento.create({ data: { userId: ctx.userId, motivo: "reembolso", escolha: "aceitou_oferta", via: "site" } });
  revalidatePath("/admin/pedidos");
  return { ok: true, avisarEm: avisarEm.toISOString().slice(0, 10) };
}
