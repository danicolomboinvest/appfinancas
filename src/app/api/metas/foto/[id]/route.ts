import { auth } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * A foto que a pessoa enviou para uma meta ("Usar uma minha"). Só sai para a dona: sem sessão, ou
 * de outra pessoa, é 404 (nem confirma que existe). Cache só no aparelho dela.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user || !/^[a-z0-9]{10,40}$/.test(id)) return new Response(null, { status: 404 });
  // Qualquer perfil da própria conta: a foto é dela, e a meta que aponta para ela também.
  const foto = await prisma.fotoDaMeta.findFirst({ where: { id, userId: session.user.id }, select: { tipo: true, dados: true } });
  if (!foto) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(foto.dados), {
    headers: { "Content-Type": foto.tipo, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
