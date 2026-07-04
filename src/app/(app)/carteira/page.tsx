import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AssetForm } from "./AssetForm";
import { DeleteAssetButton } from "./DeleteAssetButton";

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
        title="Carteira de Investimentos"
        subtitle={
          <>
            Cadastre seus ativos e marque o objetivo de cada um.{" "}
            <Link href="/carteira/por-objetivo" className="text-gold-strong hover:underline">
              Ver consolidação por objetivo →
            </Link>
          </>
        }
      />

      <AssetForm goals={goals.map((goal) => ({ id: goal.id, name: goal.name }))} />

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-ink-muted">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Classe</th>
              <th className="px-4 py-3 font-medium">Objetivo</th>
              <th className="px-4 py-3 font-medium">Valor atual</th>
              <th className="px-4 py-3 font-medium">Alocação ideal</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                <td className="px-4 py-3 text-ink">
                  {asset.name}
                  {asset.ticker ? ` (${asset.ticker})` : ""}
                </td>
                <td className="px-4 py-3 text-ink-muted">{CLASS_LABEL[asset.assetClass]}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {OBJECTIVE_LABEL[asset.objective]}
                  {asset.objective === "META" && asset.goalId ? ` — ${goalNameById.get(asset.goalId) ?? ""}` : ""}
                </td>
                <td className="px-4 py-3 text-ink">{formatBRL(Number(asset.currentValue))}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {asset.idealAllocationPercent ? `${(Number(asset.idealAllocationPercent) * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3">
                  <DeleteAssetButton id={asset.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {assets.length === 0 && <EmptyState message="Nenhum ativo cadastrado ainda." />}
      </Card>
    </div>
  );
}
