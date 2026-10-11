import { getRequiredSession } from "@/lib/auth/session";
import { carregarDadosDasCalculadoras } from "@/lib/calculadoras/dados-do-app";
import { ValeGuiado } from "@/components/calculadoras/fluxos/ValeGuiado";

/**
 * Vale a pena comprar? (versão nova, 11/10/2026): duas perguntas e a resposta em horas de
 * trabalho. A renda é a mesma do "Posso comprar?" (rendaDeReferencia: plano, típica ou o mês).
 */
export default async function ValeAPenaPage() {
  const ctx = await getRequiredSession();
  const dados = await carregarDadosDasCalculadoras(ctx);
  return <ValeGuiado dados={dados} />;
}
