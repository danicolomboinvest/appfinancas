import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Minha Carteira</h1>
        <p className="mt-1 text-sm text-black/60">
          Cadastre seus ativos e marque o objetivo de cada um.{" "}
          <Link href="/carteira/por-objetivo" className="underline">
            Ver consolidação por objetivo →
          </Link>
        </p>
      </div>

      <AssetForm goals={goals.map((goal) => ({ id: goal.id, name: goal.name }))} />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-black/60">
            <th className="py-2">Nome</th>
            <th className="py-2">Classe</th>
            <th className="py-2">Objetivo</th>
            <th className="py-2">Valor atual</th>
            <th className="py-2">Alocação ideal</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id} className="border-b border-black/5">
              <td className="py-2">
                {asset.name}
                {asset.ticker ? ` (${asset.ticker})` : ""}
              </td>
              <td className="py-2">{CLASS_LABEL[asset.assetClass]}</td>
              <td className="py-2">
                {OBJECTIVE_LABEL[asset.objective]}
                {asset.objective === "META" && asset.goalId ? ` — ${goalNameById.get(asset.goalId) ?? ""}` : ""}
              </td>
              <td className="py-2">{formatBRL(Number(asset.currentValue))}</td>
              <td className="py-2">
                {asset.idealAllocationPercent ? `${(Number(asset.idealAllocationPercent) * 100).toFixed(1)}%` : "—"}
              </td>
              <td className="py-2">
                <DeleteAssetButton id={asset.id} />
              </td>
            </tr>
          ))}
          {assets.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-black/40">
                Nenhum ativo cadastrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
