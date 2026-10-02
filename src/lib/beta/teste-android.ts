"use server";

import { auth } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { RESPONDER_PARA } from "@/lib/onboarding/enviar-boas-vindas";

/**
 * Teste fechado do app Android (out/2026): o Google Play só libera a loja depois de 12
 * testadoras por 14 dias. Quem usa o site pelo Android se oferece pelo cartão do topo e o Gmail
 * chega por e-mail em contato@, pra Dani pôr na lista de testadoras do Play Console. Nada é
 * gravado no banco.
 */
export type RespostaTesteAndroid = { ok: true } | { ok: false; mensagem: string };

const GMAIL = /^[a-z0-9._%+-]+@(gmail|googlemail)\.com$/i;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function queroTestarAndroidAction(gmailDigitado: string): Promise<RespostaTesteAndroid> {
  const session = await auth();
  if (!session?.user) return { ok: false, mensagem: "Entre na sua conta de novo e tente outra vez." };
  const gmail = String(gmailDigitado ?? "").trim().toLowerCase();
  if (!GMAIL.test(gmail)) return { ok: false, mensagem: "Use o Gmail que está no seu celular Android (termina em @gmail.com)." };

  const conta = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } });
  const nome = conta?.name?.trim() || "(sem nome)";
  const r = await sendEmail({
    // contato@ é a caixa que a Dani lê (app@ é só o remetente do app).
    to: RESPONDER_PARA,
    replyTo: gmail,
    subject: `Testadora Android: ${gmail}`,
    html: `<p><strong>${esc(nome)}</strong> quer testar o app Android.</p>
<p>Gmail do celular: <strong>${esc(gmail)}</strong><br>E-mail da conta no SPI Finance: ${esc(conta?.email ?? "?")}</p>
<p>Adicione o Gmail na lista de testadores do teste fechado no Google Play Console.</p>`,
  });
  return r.ok ? { ok: true } : { ok: false, mensagem: "Não deu pra enviar agora. Tente de novo em instantes." };
}
