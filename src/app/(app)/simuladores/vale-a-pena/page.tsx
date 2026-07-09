import { getRequiredSession } from "@/lib/auth/session";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
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
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const summary = await getMonthlySummary(ctx, year, month);

  return (
    <WorthItCalculator
      monthlyIncome={summary.totalIncome}
      incomeMonthLabel={`${MONTH_LABELS[month - 1]}/${year}`}
    />
  );
}
