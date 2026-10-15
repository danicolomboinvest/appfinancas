/**
 * A resposta ao aviso "Saúde passou R$ 153" (pedido da Dani, 14/10/2026: "quando eu respondo, eu
 * quero que você tire aquilo"). A regra mora agora no módulo único de avisos (lib/avisos/regra.ts),
 * que vale para todas as telas; aqui ficam só os nomes de antes, para quem já importava daqui.
 */
export { VOLTA_COM, VOLTA_COM_PELO_MENOS, respostaSeguraOAviso } from "@/lib/avisos/regra";

/** O id do aviso de uma categoria que passou, o mesmo do Foco e do Decidir. */
export const idDoEstouro = (categoria: string) => `estouro-${categoria}`;

export type AvisoDispensado = { id: string; passou: number | null };
