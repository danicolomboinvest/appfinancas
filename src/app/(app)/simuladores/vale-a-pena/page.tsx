import { getRequiredSession } from "@/lib/auth/session";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { getRendaTipica } from "@/lib/planning/typical-expense";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { rendaDeReferencia } from "@/lib/simulators/worth-it";
import { WorthItCalculator } from "@/components/simulators/WorthItCalculator";

const MONTH_LABELS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export default async function ValeAPenaPage() {
  const ctx = await getRequiredSession();
  // Mês de Brasília: com new Date() no servidor (UTC), das 21h à meia-noite do último dia
  // a tela já lia o mês seguinte, quase sempre sem renda nenhuma.
  const now = nowInBrazil();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [summary, plan, rendaTipica] = await Promise.all([
    getMonthlySummary(ctx, year, month),
    getMonthlyPlan(ctx, year, month),
    getRendaTipica(ctx),
  ]);
  const renda = rendaDeReferencia(plan?.plannedIncome, rendaTipica?.valor, summary.totalIncome);

  return (
    <WorthItCalculator
      monthlyIncome={renda.valor}
      incomeSource={renda.fonte}
      incomeMonthLabel={`${MONTH_LABELS[month - 1]}/${year}`}
    />
  );
}
