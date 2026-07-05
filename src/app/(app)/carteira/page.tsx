import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
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

type Asset = Awaited<ReturnType<typeof listAssets>>[number];

export default async function CarteiraPage() {
  const ctx = await getRequiredSession();
  const [assets, goals] = await Promise.all([listAssets(ctx), listGoals(ctx)]);
  const goalNameById = new Map(goals.map((goal) => [goal.id, goal.name]));

  const columns: ResponsiveColumn<Asset>[] = [
    { key: "name", label: "Nome", render: (asset) => `${asset.name}${asset.ticker ? ` (${asset.ticker})` : ""}` },
    { key: "class", label: "Classe", render: (asset) => CLASS_LABEL[asset.assetClass] },
    {
      key: "objective",
      label: "Objetivo",
      render: (asset) =>
        `${OBJECTIVE_LABEL[asset.objective]}${
          asset.objective === "META" && asset.goalId ? ` — ${goalNameById.get(asset.goalId) ?? ""}` : ""
        }`,
    },
    { key: "value", label: "Valor atual", render: (asset) => formatBRL(Number(asset.currentValue)) },
    {
      key: "ideal",
      label: "Alocação ideal",
      render: (asset) => (asset.idealAllocationPercent ? `${(Number(asset.idealAllocationPercent) * 100).toFixed(1)}%` : "—"),
    },
    {
      key: "actions",
      label: "",
      hideLabelOnMobile: true,
      render: (asset) => <DeleteAssetButton id={asset.id} />,
    },
  ];

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

      <ResponsiveTable columns={columns} rows={assets} rowKey={(asset) => asset.id} emptyMessage="Nenhum ativo cadastrado ainda." />
    </div>
  );
}
