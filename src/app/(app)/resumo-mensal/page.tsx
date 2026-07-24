import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getRecapDismissedMonth } from "@/lib/repositories/user.repo";
import { computeMonthlyRecap, getRecapEligibility } from "@/lib/recap/monthly";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { RecapStories } from "./RecapStories";

/** Resumo Mensal em formato de stories (tela cheia, imersivo). Sem dados, ou fora da janela de
 * fim/início de mês, ou já fechado esse mês → volta pro Fluxo. */
export default async function ResumoMensalPage() {
  const ctx = await getRequiredSession();
  const dismissedMonth = await getRecapDismissedMonth(ctx);
  const { year, month, monthKey } = getRecapEligibility(nowInBrazil(), dismissedMonth);
  const recap = await computeMonthlyRecap(ctx, year, month);
  if (!recap.hasData) redirect("/mensal");
  return <RecapStories recap={recap} monthKey={monthKey} />;
}
