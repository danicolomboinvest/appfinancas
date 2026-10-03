import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { ehCasal } from "@/lib/profiles/casal";
import { vozDoTema } from "@/lib/profiles/voice";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { DivisaoCalculadora } from "./DivisaoCalculadora";
import { carregarAcertoDoMes } from "@/lib/repositories/casal.repo";
import { AcertoDoMesCard } from "@/components/casal/AcertoDoMesCard";
import { ConfigCasalForm } from "@/components/casal/ConfigCasalForm";

/**
 * Divisão do casal — só existe no perfil Casal. Em cima, o acerto do mês, calculado pelos
 * lançamentos (quem pagou cada gasto da casa; out/2026). Depois os nomes e a forma de dividir, e
 * por último a calculadora "Quanto cada um contribui?", pra simular com rendas digitadas.
 */
export default async function DivisaoPage() {
  const ctx = await getRequiredSession();
  if (!ehCasal(ctx.profileKind)) redirect("/dashboard");
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;

  const now = nowInBrazil();
  const [summary, acerto] = await Promise.all([
    getMonthlySummary(ctx, now.getFullYear(), now.getMonth() + 1),
    carregarAcertoDoMes(ctx, now.getFullYear(), now.getMonth() + 1),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.casTitulo} subtitle={t.casSub} />
      <AcertoDoMesCard acerto={acerto} />
      <ConfigCasalForm config={acerto.config} />
      <h2 className="mt-2 text-base font-semibold tracking-tight text-ink">Simular a divisão</h2>
      <DivisaoCalculadora despesasComunsInicial={summary.totalExpense} />
    </div>
  );
}
