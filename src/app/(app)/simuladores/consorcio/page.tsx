import { getRequiredSession } from "@/lib/auth/session";
import { carregarDadosDasCalculadoras, lerSimulacaoSalva } from "@/lib/calculadoras/dados-do-app";
import { ConsorcioGuiado } from "@/components/calculadoras/fluxos/ConsorcioGuiado";

/** Consórcio ou financiamento? Quatro perguntas, no formato guiado da versão nova (11/10/2026). A conta é a mesma de sempre. */
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const ctx = await getRequiredSession();
  const { s } = await searchParams;
  const [dados, salva] = await Promise.all([carregarDadosDasCalculadoras(ctx), lerSimulacaoSalva(ctx, s, "CONSORCIO_VS_FINANCIAMENTO")]);
  return <ConsorcioGuiado key={salva?.id ?? "novo"} dados={dados} salva={salva} />;
}
