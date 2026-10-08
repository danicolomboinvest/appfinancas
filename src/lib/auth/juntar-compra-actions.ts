"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth.config";
import { confirmarCodigoDaCompra, pedirCodigoDaCompra } from "./juntar-compra";

/** A tela "sem acesso" pede o código (ver lib/auth/juntar-compra.ts). */
export async function pedirCodigoDaCompraAction(email: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, erro: "Entre de novo no app e tente outra vez." };
  return pedirCodigoDaCompra(session.user.id, email);
}

export async function confirmarCodigoDaCompraAction(email: string, codigo: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, erro: "Entre de novo no app e tente outra vez." };
  const r = await confirmarCodigoDaCompra(session.user.id, email, codigo);
  if (r.ok) revalidatePath("/", "layout");
  return r;
}
