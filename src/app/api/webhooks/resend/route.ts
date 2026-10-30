import { NextResponse } from "next/server";
import { conferirAssinaturaSvix, lerCabecalhosSvix } from "@/lib/email/svix";
import { lerDevolucao, registrarDevolucao, type EventoDaResend } from "@/lib/email/devolucoes";

/**
 * Webhook da Resend (30/10/2026): avisa quando um e-mail do app foi devolvido (`email.bounced`)
 * ou marcado como spam (`email.complained`). Antes essas devoluções só apareciam na caixa do app@
 * (73 em 30 dias) e ninguém via.
 *
 * Segurança: a Resend assina cada chamada no padrão Svix (headers `svix-id`, `svix-timestamp`,
 * `svix-signature`) com o Signing secret que ela mostra ao criar o webhook. Esse segredo vai na
 * variável RESEND_WEBHOOK_SECRET da Vercel. Sem o segredo configurado, a rota responde 503 e não
 * grava nada (fail closed); assinatura errada responde 401.
 *
 * O que grava: quem tem conta ganha um `Decisao` tipo `email_devolvido` (aparece na Jornada do
 * admin); todo caso vai pro AppError (rota "e-mail") com o e-mail mascarado. Outros eventos
 * respondem 200 `ignored` para a Resend não ficar reenviando.
 */

export async function POST(request: Request) {
  const segredo = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!segredo) return NextResponse.json({ error: "webhook não configurado" }, { status: 503 });

  const corpo = await request.text();
  const assinatura = conferirAssinaturaSvix(segredo, lerCabecalhosSvix(request.headers), corpo);
  if (!assinatura.ok) return NextResponse.json({ error: "assinatura inválida", motivo: assinatura.motivo }, { status: 401 });

  let evento: EventoDaResend;
  try {
    evento = JSON.parse(corpo) as EventoDaResend;
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const devolucao = lerDevolucao(evento);
  if (!devolucao) return NextResponse.json({ ok: true, status: "ignored", type: evento.type ?? null });

  const onde = await registrarDevolucao(devolucao);
  return NextResponse.json({ ok: true, status: "recorded", evento: devolucao.evento, onde });
}
