import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import { aparelhoValido, chaveDoCabecalho, criarChaveDoWidget, revogarChave, revogarTodasAsChaves } from "@/lib/widget/token";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "private, no-store" };

/** Só aceita pedido da própria página (a sessão é cookie: sem isso outro site pediria por ela). */
function mesmaOrigem(request: Request): boolean {
  const origem = request.headers.get("origin");
  if (!origem) return false;
  try {
    return new URL(origem).host === new URL(request.url).host || new URL(origem).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/**
 * Gera a chave do widget deste aparelho (11/10/2026). Chamado pelo site, dentro do app do
 * iPhone, quando ela está logada (ver PonteDoWidget). Precisa da sessão; devolve a chave UMA vez.
 * Corpo: { aparelho: "<id sorteado pelo app>" }.
 */
export async function POST(request: Request) {
  if (!mesmaOrigem(request)) return NextResponse.json({ erro: "origem" }, { status: 403, headers: SEM_CACHE });
  const session = await auth();
  if (!session?.user) return NextResponse.json({ erro: "sem-sessao" }, { status: 401, headers: SEM_CACHE });
  let corpo: { aparelho?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "corpo" }, { status: 400, headers: SEM_CACHE });
  }
  if (!aparelhoValido(corpo.aparelho)) return NextResponse.json({ erro: "aparelho" }, { status: 400, headers: SEM_CACHE });
  const chave = await criarChaveDoWidget(session.user.id, corpo.aparelho);
  return NextResponse.json({ chave }, { headers: SEM_CACHE });
}

/**
 * Desliga a chave. Com "Authorization: Bearer spiw_..." revoga só ela (o app faz isso quando ela
 * sai da conta). Com a sessão e sem chave, revoga todas as da conta.
 */
export async function DELETE(request: Request) {
  const chave = chaveDoCabecalho(request.headers.get("authorization"));
  if (chave) {
    await revogarChave(chave);
    return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
  }
  if (!mesmaOrigem(request)) return NextResponse.json({ erro: "origem" }, { status: 403, headers: SEM_CACHE });
  const session = await auth();
  if (!session?.user) return NextResponse.json({ erro: "sem-sessao" }, { status: 401, headers: SEM_CACHE });
  const n = await revogarTodasAsChaves(session.user.id);
  return NextResponse.json({ ok: true, revogadas: n }, { headers: SEM_CACHE });
}
