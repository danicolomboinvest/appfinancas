"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { registrarDecisao } from "@/lib/repositories/decisao.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { dadosDaRespostaDeCategoria } from "@/lib/avisos/respostas";
import { chaveDaSemana } from "../ritmo";
import { TIPOS_DE_SUGESTAO, type TipoDeSugestao } from "./regras";

/**
 * "Agora não" (ou "Boa", no indo bem, ou o toque no botão) numa sugestão do Resumo novo. Guarda a
 * marca do extrato da hora e, na de categoria, o gasto da categoria agora e quanto ela tinha subido:
 * a regra única (lib/avisos) decide, em todas as telas, quando ela volta.
 */
export async function dispensarSugestaoAction(tipo: TipoDeSugestao, id: string, marca: string, boa = false, botao = false, excesso?: number) {
  if (!(TIPOS_DE_SUGESTAO as readonly string[]).includes(tipo) || typeof id !== "string" || typeof marca !== "string") return;
  const ctx = await getRequiredSession();
  const agora = nowInBrazil();
  const como = boa === true ? "boa" : botao === true ? "botao" : "agora-nao";
  const daCategoria =
    tipo === "categoria" && como !== "boa"
      ? await dadosDaRespostaDeCategoria(ctx, id.slice(0, 60), como, agora, typeof excesso === "number" && Number.isFinite(excesso) && excesso >= 0 ? Math.min(excesso, 1e8) : undefined)
      : null;
  await registrarDecisao(ctx, {
    tipo: "sugestao_dispensada",
    chave: `${tipo}|${id}`.slice(0, 190),
    descricao: marca.slice(0, 60),
    dados: { boa: boa === true, semana: chaveDaSemana(agora), como, ...(daCategoria ? { gasto: daCategoria.gasto, excesso: daCategoria.excesso } : {}) },
  });
  revalidatePath("/mensal/foco");
  // A mesma resposta vale no Orçamento e no Decidir (lib/avisos).
  revalidatePath("/orcamento", "layout");
  revalidatePath("/decidir");
}
