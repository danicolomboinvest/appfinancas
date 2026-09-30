import { NextResponse } from "next/server";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { prisma } from "@/lib/db/prisma";

export const maxDuration = 60;

type Mensagem = { to: string; subject: string; html: string };

/**
 * E-mail de suporte avulso pra cliente, saindo pelo mesmo remetente do app (Hostinger).
 *
 * Existe porque a senha do SMTP só está certa na Vercel: do Mac, o envio falha com 535 e a Dani
 * ficava sem como avisar uma cliente de um problema que a gente já corrigiu (29/09/2026: seis
 * contas com importação errada, cada uma precisando desfazer e subir de novo).
 *
 * Protegida pelo CRON_SECRET, e só envia pra e-mail que tem conta no app: se o segredo vazar, a
 * rota não vira disparador de spam pra qualquer endereço.
 *
 * POST { mensagens: [{ to, subject, html }] } → { resultados: [{ to, ok, motivo? }] }
 */
export async function POST(request: Request) {
  const recusa = recusarSeNaoForCron(request);
  if (recusa) return recusa;
  if (!isEmailConfigured()) return NextResponse.json({ error: "e-mail não configurado" }, { status: 503 });

  const corpo = (await request.json().catch(() => null)) as { mensagens?: Mensagem[] } | null;
  const mensagens = Array.isArray(corpo?.mensagens) ? corpo.mensagens.slice(0, 20) : [];
  if (mensagens.length === 0) return NextResponse.json({ error: "nenhuma mensagem" }, { status: 400 });

  const resultados: { to: string; ok: boolean; motivo?: string }[] = [];
  for (const m of mensagens) {
    const to = String(m?.to ?? "").trim().toLowerCase();
    if (!to || !m.subject || !m.html) {
      resultados.push({ to, ok: false, motivo: "faltou destinatário, assunto ou texto" });
      continue;
    }
    const conta = await prisma.user.findFirst({ where: { email: { equals: to, mode: "insensitive" } }, select: { id: true } });
    if (!conta) {
      resultados.push({ to, ok: false, motivo: "sem conta no app" });
      continue;
    }
    const r = await sendEmail({ to, subject: String(m.subject), html: String(m.html) });
    resultados.push(r.ok ? { to, ok: true } : { to, ok: false, motivo: r.reason });
  }
  return NextResponse.json({ resultados });
}
