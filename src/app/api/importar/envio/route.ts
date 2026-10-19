import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth/auth.config";
import { ARQUIVO_MAX_BYTES, pastaDoEnvio } from "@/lib/import/limites";

/**
 * Arquivo grande da importação (19/10/2026): a Vercel recusa envio acima de ~4,5 MB, então o
 * aparelho manda o extrato direto para o armazenamento privado. Esta rota só autoriza: diz ao
 * aparelho a pasta dele (GET) e dá a chave de envio de UM arquivo, só nessa pasta e até 25 MB (POST).
 * A leitura e o apagar ficam em src/lib/import/arquivo-grande.ts.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true, pasta: pastaDoEnvio(session.user.id) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = session.user.id;
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const r = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(pastaDoEnvio(userId)) || pathname.includes("..")) throw new Error("pasta errada");
        return { maximumSizeInBytes: ARQUIVO_MAX_BYTES, addRandomSuffix: true, validUntil: Date.now() + 15 * 60_000 };
      },
    });
    return NextResponse.json(r);
  } catch (err) {
    console.error("importar/envio: chave recusada", err);
    return NextResponse.json({ error: "não autorizado" }, { status: 400 });
  }
}
