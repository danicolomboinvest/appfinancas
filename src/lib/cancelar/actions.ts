"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { compraDoApp } from "@/lib/assinatura/compra";
import { dataLonga, renovacaoEm } from "@/lib/assinatura/renovacao";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { SUPORTE_EMAIL } from "@/app/(app)/configuracoes/_ajustes/suporte";
import { AREAS, dentroDoReembolso, diaDoAviso, diaDoLembreteDoReembolso, ofertaDisponivel, PEDIDO_DO_MOTIVO, type TipoDePedido } from "./regras";
import { prazoComPresente } from "./presente";
import { respostaDaDuvida, type Resposta } from "./assuntos";
import { emailDaDuvida, emailDoErrado, emailDosMeses, emailEstenderNaHubla } from "./emails";
import { linkDaAssinaturaNaHubla } from "@/lib/assinatura/hubla-assinatura";
import { destinatario, enviarDoPedido, URL_DO_APP } from "./envio";

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

export type ResultadoDoPedido =
  | { ok: true; acessoAte?: string; avisarEm?: string; resposta?: Resposta }
  | { ok: false; erro: string };

const diagnostico = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).optional(), lancamentoId: z.string().max(40).optional() }).optional();

/**
 * A pessoa aceitou a ajuda do motivo. Tudo automático (decisão da Dani, 11/10): os 2 meses entram
 * na hora, a dúvida ganha resposta na hora, o "algo errado" ganha confirmação e vai para a fila.
 * Cada tipo, uma vez a cada 12 meses. Só para quem pagou no site e não cancelou.
 */
export async function pedirAntesDeCancelarAction(input: { motivo: string; texto?: string; area?: string; diagnostico?: { mes?: string; lancamentoId?: string } }): Promise<ResultadoDoPedido> {
  const r = z
    .object({ motivo: z.enum(["caro", "dificil", "errado", "naouso", "outro"]), texto: z.string().trim().max(4000).optional(), area: z.enum(AREAS).optional(), diagnostico })
    .safeParse(input);
  if (!r.success) return { ok: false, erro: "Confira o que foi escrito." };
  const { motivo, texto, area } = r.data;
  const tipo: TipoDePedido = PEDIDO_DO_MOTIVO[motivo];
  if ((tipo === "duvida" || tipo === "contestacao") && !texto) return { ok: false, erro: "Escreva ou grave o que aconteceu." };

  const ctx = await getRequiredSession();
  const para = await destinatario(ctx.userId);
  if (!para) return { ok: false, erro: "Não achei a sua conta." };
  const compra = await compraDoApp(ctx.userId, para.email);
  if (!compra || compra.via !== "site") return { ok: false, erro: "Esta ajuda vale para quem pagou pelo site." };

  const ultimo = await prisma.pedidoAntesDeCancelar.findFirst({ where: { userId: ctx.userId, tipo }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (!ofertaDisponivel(ultimo?.createdAt ?? null, new Date())) return { ok: false, erro: "Você já usou esta ajuda nos últimos 12 meses." };

  const hoje = nowInBrazil();
  const renova = renovacaoEm(compra.em, hoje);
  const base = { tema: para.tema, nome: para.nome, urlDoApp: URL_DO_APP };
  await prisma.motivoDeCancelamento.create({ data: { userId: ctx.userId, motivo, escolha: "aceitou_oferta", via: "site", texto: motivo === "outro" ? texto || null : null } });

  if (tipo === "meses_gratis") {
    // Soma 60 dias ao prazo do acesso, na hora. A cobrança na Hubla anda 60 dias por um toque
    // da Dani: o e-mail para ela sai agora, com o link direto da assinatura.
    const acesso = await prisma.allowedEmail.findUnique({ where: { email: normalizeEmail(para.email) }, select: { hublaSubscriptionId: true } });
    const novo = prazoComPresente(compra.acessoAte, renova);
    await prisma.allowedEmail.update({ where: { email: normalizeEmail(para.email) }, data: { expiresAt: novo } });
    const link = linkDaAssinaturaNaHubla(acesso?.hublaSubscriptionId ?? null, para.email);
    const pedido = await prisma.pedidoAntesDeCancelar.create({ data: { userId: ctx.userId, tipo, dados: { antes: compra.acessoAte?.toISOString() ?? null, depois: novo.toISOString(), link } } });
    const ate = dataLonga(novo);
    await enviarDoPedido(pedido.id, para, emailDosMeses({ ...base, ate }));
    const aviso = emailEstenderNaHubla({ nome: para.nome, email: para.email, link });
    await sendEmail({ to: SUPORTE_EMAIL, subject: aviso.subject, html: aviso.html });
    revalidarTudo();
    return { ok: true, acessoAte: ate };
  }

  if (tipo === "duvida") {
    const { assunto, resposta } = respostaDaDuvida(texto!);
    // Fica registrada para o agente de suporte (outro projeto) e responde na hora.
    const pedido = await prisma.pedidoAntesDeCancelar.create({ data: { userId: ctx.userId, tipo, texto: texto!, assunto, estado: "feito", feitoEm: new Date(), feitoPor: "resposta automática" } });
    await enviarDoPedido(pedido.id, para, emailDaDuvida({ ...base, resposta, duvida: texto! }));
    revalidarTudo();
    return { ok: true, resposta };
  }

  if (tipo === "contestacao") {
    const d = r.data.diagnostico ?? {};
    const lancamento = d.lancamentoId
      ? await prisma.monthlyEntry.findFirst({ where: { id: d.lancamentoId, userId: ctx.userId, profileId: ctx.profileId }, select: { id: true, description: true, amount: true, entryDate: true, year: true, month: true, category: true, parentCategory: true } })
      : null;
    const dados = { tela: area ?? null, mes: d.mes ?? null, perfilId: ctx.profileId, lancamento: lancamento ? { ...lancamento, amount: Number(lancamento.amount) } : null };
    const pedido = await prisma.pedidoAntesDeCancelar.create({ data: { userId: ctx.userId, tipo, texto: texto!, area: area ?? null, dados } });
    await enviarDoPedido(pedido.id, para, emailDoErrado(base));
    // A fila: o /admin/pedidos, e o app@ fica sabendo.
    await sendEmail({
      to: SUPORTE_EMAIL,
      subject: `Algo não está certo · ${para.email}`,
      html: `<p>${escapar(para.email)}: ${escapar(area ?? "sem tela")}${d.mes ? `, ${d.mes}` : ""}${lancamento ? `, lançamento ${escapar(lancamento.description ?? "")} (${Number(lancamento.amount)})` : ""}.</p><p>${escapar(texto!)}</p><p>Responder em até 48 horas. Fila em /admin/pedidos.</p>`,
      replyTo: para.email,
    });
    revalidarTudo();
    return { ok: true };
  }

  if (tipo === "aviso_renovacao") {
    const avisarEm = diaDoAviso(renova);
    await prisma.pedidoAntesDeCancelar.create({ data: { userId: ctx.userId, tipo, avisarEm } });
    revalidarTudo();
    return { ok: true, avisarEm: dataLonga(avisarEm) };
  }

  // Outro motivo, "Prefiro falar com a equipe".
  await prisma.pedidoAntesDeCancelar.create({ data: { userId: ctx.userId, tipo, texto: texto || null } });
  await sendEmail({ to: SUPORTE_EMAIL, subject: `Quer falar com a equipe · ${para.email}`, html: `<p>${escapar(para.email)} quer falar com a equipe antes de cancelar.</p>${texto ? `<p>${escapar(texto)}</p>` : ""}`, replyTo: para.email });
  revalidarTudo();
  return { ok: true };
}

function revalidarTudo() {
  revalidatePath("/configuracoes");
  revalidatePath("/admin/pedidos");
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
  revalidarTudo();
  return { ok: true, avisarEm: dataLonga(avisarEm) };
}

/** /admin/pedidos: "Feito na Hubla" (os 2 meses) ou "Respondido" (algo errado). */
export async function marcarPedidoFeitoAction(id: string): Promise<{ ok: boolean }> {
  const ctx = await requireAdmin();
  const v = z.string().min(1).safeParse(id);
  if (!v.success) return { ok: false };
  const admin = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true } });
  await prisma.pedidoAntesDeCancelar.update({ where: { id: v.data }, data: { estado: "feito", feitoEm: new Date(), feitoPor: admin?.email ?? null } });
  revalidatePath("/admin/pedidos");
  return { ok: true };
}
