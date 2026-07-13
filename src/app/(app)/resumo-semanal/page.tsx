import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { computeWeeklyRecap } from "@/lib/recap/weekly";
import { RecapStories } from "./RecapStories";

/** Resumo Semanal em formato de stories (tela cheia, imersivo). Sem dados ainda → volta pro Fluxo. */
export default async function ResumoSemanalPage() {
  const ctx = await getRequiredSession();
  const recap = await computeWeeklyRecap(ctx);
  if (!recap.hasData) redirect("/mensal");
  return <RecapStories recap={recap} />;
}
