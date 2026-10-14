import { NextResponse } from "next/server";
import { VERSAO_DO_APP } from "@/lib/erros/versao-nova";

/**
 * Qual versão está no ar (13/10/2026). O aparelho compara com a dele quando uma ação falha sem
 * dizer por quê: se mudou, o app foi atualizado com a tela aberta e recarrega (src/lib/erros/versao-nova.ts).
 * Aberta sem sessão (só devolve o número da versão) e nunca guardada em cache.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ versao: VERSAO_DO_APP }, { headers: { "Cache-Control": "no-store" } });
}
