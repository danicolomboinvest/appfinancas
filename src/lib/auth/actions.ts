"use server";

import { auth, signOut } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";

/**
 * Sai da conta. `endpointDoAparelho` é a inscrição de avisos deste navegador, se houver: ela é
 * apagada junto, senão os avisos da pessoa (orçamento estourado, meta atrasada, com valores)
 * continuavam chegando neste aparelho depois que outra pessoa entrasse nele com a conta dela.
 */
export async function logoutAction(endpointDoAparelho?: string) {
  if (typeof endpointDoAparelho === "string" && endpointDoAparelho) {
    const session = await auth();
    // Só a inscrição DESTA conta com este endpoint: o valor vem do navegador.
    if (session?.user?.id) {
      await prisma.pushSubscription
        .deleteMany({ where: { userId: session.user.id, endpoint: endpointDoAparelho } })
        .catch(() => undefined);
    }
  }
  await signOut({ redirectTo: "/login" });
}
