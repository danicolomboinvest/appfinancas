import { NextResponse } from "next/server";
import { verificarAviso, verificarTransacao } from "@/lib/apple/verificar";
import { aplicarAvisoApple } from "@/lib/repositories/assinaturaApple.repo";

/**
 * App Store Server Notifications V2: a Apple avisa sozinha quando a assinatura renova, é
 * reembolsada ou revogada. Configurado em App Store Connect > Informações do app > Notificações
 * do servidor da App Store (produção e sandbox apontam pra cá).
 *
 * Não tem token: quem garante que veio da Apple é a assinatura criptográfica do corpo, conferida
 * com o certificado raiz dela. Corpo que não passa leva 400 e não mexe em nada.
 */
export async function POST(request: Request) {
  let signedPayload: unknown;
  try {
    ({ signedPayload } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof signedPayload !== "string") return NextResponse.json({ error: "no payload" }, { status: 400 });

  const aviso = await verificarAviso(signedPayload).catch(() => null);
  if (!aviso) return NextResponse.json({ error: "invalid signature" }, { status: 400 });

  const signedTx = aviso.data?.signedTransactionInfo;
  if (!aviso.notificationType || !signedTx) return NextResponse.json({ ok: true, action: "ignored" });
  const tx = await verificarTransacao(signedTx).catch(() => null);
  if (!tx) return NextResponse.json({ error: "invalid transaction" }, { status: 400 });

  const action = await aplicarAvisoApple(String(aviso.notificationType), tx);
  return NextResponse.json({ ok: true, action });
}
