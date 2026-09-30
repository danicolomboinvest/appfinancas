import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getRecapDismissedMonth } from "@/lib/repositories/user.repo";
import { computeMonthlyRecap, getRecapEligibility } from "@/lib/recap/monthly";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { RecapStories } from "./RecapStories";

/** Resumo Mensal em formato de stories (tela cheia, imersivo), sempre do mês que já fechou. Sem
 * dados, ou fora da janela do dia 1 ao 7, ou já fechado esse mês → volta pro Fluxo. */
export default async function ResumoMensalPage() {
  const ctx = await getRequiredSession();
  const dismissedMonth = await getRecapDismissedMonth(ctx);
  const { eligible, year, month, monthKey } = getRecapEligibility(nowInBrazil(), dismissedMonth);
  // Fora da janela (dia 8 em diante) ou já fechado: aberto pelo histórico do navegador ou atalho
  // do app no dia 15, mostrava o mês pela metade, e fechar gravava o mês como dispensado — o
  // resumo de verdade daquele mês nunca mais aparecia.
  if (!eligible) redirect("/mensal");
  const recap = await computeMonthlyRecap(ctx, year, month);
  if (!recap.hasData) redirect("/mensal");
  return <RecapStories recap={recap} monthKey={monthKey} />;
}
