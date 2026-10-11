import { getRequiredSession } from "@/lib/auth/session";
import { carregarDadosDasCalculadoras, lerSimulacaoSalva } from "@/lib/calculadoras/dados-do-app";
import { CarroGuiado } from "@/components/calculadoras/fluxos/CarroGuiado";

/** Carro: assinar ou comprar? Três perguntas, no formato guiado da versão nova (11/10/2026). A conta é a mesma de sempre. */
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const ctx = await getRequiredSession();
  const { s } = await searchParams;
  const [dados, salva] = await Promise.all([carregarDadosDasCalculadoras(ctx), lerSimulacaoSalva(ctx, s, "CARRO")]);
  return <CarroGuiado key={salva?.id ?? "novo"} dados={dados} salva={salva} />;
}
