import { getRequiredSession } from "@/lib/auth/session";
import { carregarDadosDasCalculadoras, lerSimulacaoSalva } from "@/lib/calculadoras/dados-do-app";
import { FinanciarGuiado } from "@/components/calculadoras/fluxos/FinanciarGuiado";

/**
 * Financiar ou alugar? (versão nova, 11/10/2026): três perguntas, uma por tela, e o resultado em
 * destaque. "Mexer nos números" e a simulação salva abrem a tela ao vivo. A conta é a mesma de
 * sempre (lib/simulators/financing-vs-rent.ts).
 */
export default async function FinanciarVsAlugarPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const ctx = await getRequiredSession();
  const { s } = await searchParams;
  const [dados, salva] = await Promise.all([carregarDadosDasCalculadoras(ctx), lerSimulacaoSalva(ctx, s, "FINANCIAR_VS_ALUGAR")]);
  return <FinanciarGuiado key={salva?.id ?? "novo"} dados={dados} salva={salva} />;
}
