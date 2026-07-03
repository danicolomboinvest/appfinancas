import { auth } from "@/lib/auth/auth.config";

export type AuthContext = {
  userId: string;
  role: "ADMIN" | "CLIENT";
};

/**
 * Contexto de sessão autenticado, para ser passado explicitamente à camada de
 * repositories. Nunca aceitar userId vindo do client/body da requisição.
 */
export async function getRequiredSession(): Promise<AuthContext> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Não autenticado.");
  }
  return { userId: session.user.id, role: session.user.role };
}
