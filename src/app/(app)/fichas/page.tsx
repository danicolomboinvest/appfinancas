import { getRequiredSession } from "@/lib/auth/session";
import { carregarAnalises } from "@/lib/analysis/analises-dados";
import { AnalisesTela } from "./analises/AnalisesTela";

/**
 * Análises (versão nova, 11/10/2026): a entrada em anéis das rodadas 48 e 52. O anel grande é a
 * carteira ("5 de 6 vão bem"), a grade tem um anel de 4 pedaços por ativo, e a renda fixa fica numa
 * faixa própria. Os números vêm da última leitura de cada ticker; o que falta ler, a tela lê sozinha.
 * Os Insights e as fichas antigas continuam em /fichas/insights e /fichas/acoes.
 */
export default async function AnalisesPage() {
  const ctx = await getRequiredSession();
  const dados = await carregarAnalises(ctx);
  return <AnalisesTela dados={dados} />;
}
