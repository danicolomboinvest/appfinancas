"use server";

import { auth } from "@/lib/auth/auth.config";
import { marcarNovidadesVistas } from "@/lib/repositories/novidades.repo";

/** Grava que a pessoa já viu (ou pulou) o "Tivemos uma mudança". */
export async function marcarNovidadesVistasAction(como: "terminou" | "pulou"): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await marcarNovidadesVistas(session.user.id, como === "pulou" ? "pulou" : "terminou");
  return { ok: true };
}
