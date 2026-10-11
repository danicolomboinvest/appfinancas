import { auth } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * A foto do perfil. Só sai para a dona da conta: sem sessão é 404 (nem confirma que existe). Cache
 * só no aparelho dela; o ?v= do endereço muda a cada foto nova.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 404 });
  const foto = await prisma.fotoDaConta.findUnique({ where: { userId: session.user.id }, select: { tipo: true, dados: true } });
  if (!foto) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(foto.dados), {
    headers: { "Content-Type": foto.tipo, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
