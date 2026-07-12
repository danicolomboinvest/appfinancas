"use client";

import { useState, useTransition } from "react";
import { Briefcase, FileUp, Pencil, Plus, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast-context";
import { DonutAllocationChart } from "@/components/charts/DonutAllocationChart";
import { PortfolioImport } from "@/components/import/PortfolioImport";
import { DeleteAssetButton } from "./DeleteAssetButton";
import { AssetForm } from "./AssetForm";
import { updatePortfolioQuotesAction } from "./quotes-actions";
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

type Asset = {
  id: string;
  name: string;
  ticker: string | null;
  assetClass: string;
  objective: string;
  goalId: string | null;
  currentValue: number;
  idealAllocationPercent: number | null;
};

/** Lista de ativos + criação/edição em modal — a lista vem primeiro, o formulário só aparece
 * quando a pessoa pede (botão "+ Novo ativo" ou "Editar" em cada linha). */
export function AssetsSection({
  assets,
  goals,
  goalNameById,
}: {
  assets: Asset[];
  goals: { id: string; name: string }[];
  goalNameById: Map<string, string>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isUpdatingQuotes, startQuotesTransition] = useTransition();
  const { showToast } = useToast();

  const hasTickers = assets.some((a) => a.ticker);

  function handleUpdateQuotes() {
    startQuotesTransition(async () => {
      const result = await updatePortfolioQuotesAction();
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      showToast(
        result.failed.length > 0
          ? `${result.updated} cotações atualizadas · não achei: ${result.failed.join(", ")}`
          : `${result.updated} cotações atualizadas.`,
      );
    });
  }

  const totalValue = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const currentAllocationData = assets
    .filter((asset) => asset.currentValue > 0)
    .map((asset) => ({ id: asset.id, name: asset.name, value: totalValue > 0 ? asset.currentValue / totalValue : 0 }));
  const idealAllocationData = assets
    .filter((asset) => asset.idealAllocationPercent !== null)
    .map((asset) => ({ id: asset.id, name: asset.name, value: asset.idealAllocationPercent ?? 0 }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">{assets.length} ativo{assets.length === 1 ? "" : "s"} cadastrado{assets.length === 1 ? "" : "s"}</p>
        <div className="flex items-center gap-2">
          {hasTickers && (
            <Button type="button" size="sm" variant="secondary" onClick={handleUpdateQuotes} disabled={isUpdatingQuotes}>
              <RefreshCw size={16} strokeWidth={2} className={isUpdatingQuotes ? "animate-spin" : ""} />
              {isUpdatingQuotes ? "Atualizando..." : "Atualizar cotações"}
            </Button>
          )}
          <Button type="button" size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
            <FileUp size={16} strokeWidth={2} />
            Importar
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={16} strokeWidth={2} />
            Novo ativo
          </Button>
        </div>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          message="Nenhum ativo cadastrado ainda. Adicione o primeiro para acompanhar sua carteira aqui."
        />
      ) : (
        <>
          <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <DonutAllocationChart title="Carteira atual, por ativo" data={currentAllocationData} />
            <DonutAllocationChart title="Alocação ideal, por ativo" data={idealAllocationData} />
          </Card>

          <div className="flex flex-col gap-2">
            {assets.map((asset) => {
              const objectiveText =
                asset.objective === "META" && asset.goalId
                  ? `Meta: ${goalNameById.get(asset.goalId) ?? ""}`
                  : OBJECTIVE_LABEL[asset.objective];
              const idealText = asset.idealAllocationPercent
                ? ` · Alocação ideal: ${formatPercentNumber(asset.idealAllocationPercent * 100, 1)}`
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
                    <p className="text-sm font-medium text-ink">{formatBRL(asset.currentValue)}</p>
                    <button
                      type="button"
                      onClick={() => setEditingAsset(asset)}
                      className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
                      aria-label={`Editar ${asset.name}`}
                    >
                      <Pencil size={13} strokeWidth={1.75} />
                      Editar
                    </button>
                    <DeleteAssetButton id={asset.id} />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo ativo">
        <AssetForm goals={goals} submitLabel="Adicionar" onSuccess={() => setCreateOpen(false)} />
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar carteira">
        <PortfolioImport onDone={() => setImportOpen(false)} />
      </Modal>

      <Modal open={editingAsset !== null} onClose={() => setEditingAsset(null)} title="Editar ativo">
        {editingAsset && (
          <AssetForm
            goals={goals}
            assetId={editingAsset.id}
            submitLabel="Salvar alterações"
            onSuccess={() => setEditingAsset(null)}
            defaults={{
              name: editingAsset.name,
              ticker: editingAsset.ticker ?? undefined,
              assetClass: editingAsset.assetClass,
              objective: editingAsset.objective,
              goalId: editingAsset.goalId ?? undefined,
              currentValue: editingAsset.currentValue,
              idealAllocationPercent: editingAsset.idealAllocationPercent ?? undefined,
            }}
          />
        )}
      </Modal>
    </div>
  );
}
