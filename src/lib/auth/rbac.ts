import { notFound } from "next/navigation";
import { getRequiredSession, type AuthContext } from "@/lib/auth/session";

/** Usa notFound() em vez de um erro de permissão para não revelar a existência da área restrita. */
export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await getRequiredSession();
  if (ctx.role !== "ADMIN") {
    notFound();
  }
  return ctx;
}
