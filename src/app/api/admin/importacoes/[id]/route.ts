import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { readStoredImportFile } from "@/lib/repositories/import-file.repo";

/**
 * Baixa um arquivo de importação que falhou. Só ADMIN: é extrato bancário de cliente.
 *
 * `requireAdmin` responde 404 pra quem não é admin, em vez de 403 — não revela que a rota
 * existe. Vale o mesmo aqui: quem não deveria estar aqui não descobre nada pela resposta.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const arquivo = await readStoredImportFile(id);
  if (!arquivo) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  return new NextResponse(new Uint8Array(arquivo.content), {
    headers: {
      "Content-Type": arquivo.mimeType,
      // `attachment` força o download: abrir um HTML/SVG de origem desconhecida no mesmo domínio
      // do app deixaria ele rodar script com a sessão da Dani.
      "Content-Disposition": `attachment; filename="${arquivo.fileName.replace(/["\r\n]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
