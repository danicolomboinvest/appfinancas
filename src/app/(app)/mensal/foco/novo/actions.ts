"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { registrarDecisao } from "@/lib/repositories/decisao.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { chaveDaSemana } from "../ritmo";
import { TIPOS_DE_SUGESTAO, type TipoDeSugestao } from "./regras";

/**
 * "Agora não" (ou "Boa", no indo bem) numa sugestão do Resumo novo. Guarda a marca do extrato da
 * hora: a sugestão só volta quando chega um extrato novo. A próxima da fila aparece no lugar.
 */
export async function dispensarSugestaoAction(tipo: TipoDeSugestao, id: string, marca: string, boa = false) {
  if (!(TIPOS_DE_SUGESTAO as readonly string[]).includes(tipo) || typeof id !== "string" || typeof marca !== "string") return;
  const ctx = await getRequiredSession();
  await registrarDecisao(ctx, {
    tipo: "sugestao_dispensada",
    chave: `${tipo}|${id}`.slice(0, 190),
    descricao: marca.slice(0, 60),
    dados: { boa: boa === true, semana: chaveDaSemana(nowInBrazil()) },
  });
  revalidatePath("/mensal/foco");
}
