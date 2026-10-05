"use server";

import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { marcarConquista, type ChaveDeConquista } from "@/lib/repositories/conquista.repo";

/** A notificação da conquista foi vista: não aparece de novo. */
export async function marcarConquistaVistaAction(chave: string) {
  const c = z.string().regex(/^(meta\|[a-z0-9]{8,40}|primeiro-fechamento|reset)$/).parse(chave) as ChaveDeConquista;
  const ctx = await getRequiredSession();
  await marcarConquista(ctx, c);
}
