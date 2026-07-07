import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AssetForm } from "./AssetForm";
import { DeleteAssetButton } from "./DeleteAssetButton";
import { formatPercentNumber } from "@/lib/format";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CLASS_LABEL: Record<string, string> = {
  RENDA_FIXA: "Renda Fixa",
  ACAO: "Ação",
  FII: "FII",
  TESOURO_DIRETO: "Tesouro Direto",
  FUNDO: "Fundo",
  CRIPTO: "Cripto",
  OUTRO: "Outro",
};

const OBJECTIVE_LABEL: Record<string, string> = {
  RESERVA_EMERGENCIA: "Reserva de emergência",
  LIBERDADE_FINANCEIRA: "Liberdade financeira",
  META: "Meta",
  OUTRO: "Outro",
};

export default async function CarteiraPage() {
  const ctx = await getRequiredSession();
  const [assets, goals] = await Promise.all([listAssets(ctx), listGoals(ctx)]);
  const goalNameById = new Map(goals.map((goal) => [goal.id, goal.name]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Onde está seu patrimônio?"
        subtitle={
          <>
            Cadastre seus ativos e marque o objetivo de cada um.{" "}
            <Link href="/carteira/por-objetivo" className="text-accent-strong hover:underline">
              Ver consolidação por objetivo →
            </Link>
          </>
        }
      />

      <AssetForm goals={goals.map((goal) => ({ id: goal.id, name: goal.name }))} />

      {assets.length === 0 ? (
        <EmptyState message="Nenhum ativo cadastrado ainda." />
      ) : (
        <div className="flex flex-col gap-2">
          {assets.map((asset) => {
            const objectiveText =
              asset.objective === "META" && asset.goalId
                ? `Meta: ${goalNameById.get(asset.goalId) ?? ""}`
                : OBJECTIVE_LABEL[asset.objective];
            const idealText = asset.idealAllocationPercent
              ? ` · Alocação ideal: ${formatPercentNumber(Number(asset.idealAllocationPercent) * 100, 1)}`
              : "";
            return (
              <Card key={asset.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Badge tone="neutral">{CLASS_LABEL[asset.assetClass]}</Badge>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {asset.name}
                      {asset.ticker ? ` (${asset.ticker})` : ""}
                    </p>
                    <p className="truncate text-xs text-ink-faint">
                      {objectiveText}
                      {idealText}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-sm font-medium text-ink">{formatBRL(Number(asset.currentValue))}</p>
                  <DeleteAssetButton id={asset.id} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
