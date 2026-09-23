import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { ehCasal } from "@/lib/profiles/casal";
import { vozDoTema } from "@/lib/profiles/voice";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { DivisaoCalculadora } from "./DivisaoCalculadora";

/**
 * "Quanto cada um contribui?" — só existe no perfil Casal. As despesas comuns já vêm
 * preenchidas com o gasto real do mês; a renda de cada um a pessoa digita, porque o app não
 * sabe quem ganhou quanto dentro do casal (um login só, sem separar por pessoa).
 */
export default async function DivisaoPage() {
  const ctx = await getRequiredSession();
  if (!ehCasal(ctx.profileKind)) redirect("/dashboard");
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;

  const now = nowInBrazil();
  const summary = await getMonthlySummary(ctx, now.getFullYear(), now.getMonth() + 1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.casTitulo} subtitle={t.casSub} />
      <DivisaoCalculadora despesasComunsInicial={summary.totalExpense} />
    </div>
  );
}
