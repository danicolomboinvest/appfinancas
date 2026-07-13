import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssetsSection } from "./AssetsSection";

export default async function CarteiraPage() {
  const ctx = await getRequiredSession();
  const [assets, goals] = await Promise.all([listAssets(ctx), listGoals(ctx)]);
  const goalNameById = new Map(goals.map((goal) => [goal.id, goal.name]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Carteira de Investimentos"
        subtitle={
          <>
            Acompanhe seus ativos e o objetivo de cada um.{" "}
            <Link href="/carteira/por-objetivo" className="text-accent-strong hover:underline">
              Ver consolidação por objetivo →
            </Link>
          </>
        }
      />

      <AssetsSection
        assets={assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          objective: asset.objective,
          goalId: asset.goalId,
          quantity: asset.quantity !== null ? Number(asset.quantity) : null,
          investedValue: asset.investedValue !== null ? Number(asset.investedValue) : null,
          currentValue: Number(asset.currentValue),
          idealAllocationPercent: asset.idealAllocationPercent !== null ? Number(asset.idealAllocationPercent) : null,
        }))}
        goals={goals.map((goal) => ({ id: goal.id, name: goal.name }))}
        goalNameById={goalNameById}
      />
    </div>
  );
}
