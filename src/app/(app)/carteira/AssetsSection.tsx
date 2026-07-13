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

/** Rótulo no plural pros filtros/fatias ("Ações", "FIIs"…). */
const CLASS_PLURAL: Record<string, string> = {
  ACAO: "Ações",
  FII: "FIIs",
  FUNDO: "Fundos",
  RENDA_FIXA: "Renda Fixa",
  TESOURO_DIRETO: "Tesouro Direto",
  CRIPTO: "Cripto",
  OUTRO: "Outros",
};

/** Ordem fixa das classes no gráfico/filtros (cores estáveis entre visitas). */
const CLASS_ORDER = ["ACAO", "FII", "FUNDO", "RENDA_FIXA", "TESOURO_DIRETO", "CRIPTO", "OUTRO"];

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
  quantity: number | null;
  currentValue: number;
  idealAllocationPercent: number | null;
};

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
}

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
  const [classFilter, setClassFilter] = useState<string | null>(null);
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

  // Carteira atual agrupada por TIPO (Ações, FIIs, Fundos…) — com dezenas de ativos, uma
  // fatia por ativo vira confete; por classe o percentual conta a história de verdade.
  const valueByClass = new Map<string, number>();
  const countByClass = new Map<string, number>();
  for (const asset of assets) {
    valueByClass.set(asset.assetClass, (valueByClass.get(asset.assetClass) ?? 0) + asset.currentValue);
    countByClass.set(asset.assetClass, (countByClass.get(asset.assetClass) ?? 0) + 1);
  }
  const classAllocationData = CLASS_ORDER.filter((c) => (valueByClass.get(c) ?? 0) > 0).map((c) => ({
    id: c,
    name: CLASS_PLURAL[c],
    value: totalValue > 0 ? (valueByClass.get(c) ?? 0) / totalValue : 0,
  }));
  const idealAllocationData = assets
    .filter((asset) => asset.idealAllocationPercent !== null)
    .map((asset) => ({ id: asset.id, name: asset.name, value: asset.idealAllocationPercent ?? 0 }));

  // Filtro por tipo: clicar na fatia/legenda ou nos chips mostra só os ativos daquele tipo,
  // do maior pro menor valor.
  const classesPresent = CLASS_ORDER.filter((c) => (countByClass.get(c) ?? 0) > 0);
  const visibleAssets = [...assets]
    .filter((a) => classFilter === null || a.assetClass === classFilter)
    .sort((a, b) => b.currentValue - a.currentValue);

  function toggleClassFilter(assetClass: string) {
    setClassFilter((prev) => (prev === assetClass ? null : assetClass));
  }

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
            <DonutAllocationChart
              title="Carteira atual, por tipo"
              data={classAllocationData}
              onSelect={(slice) => slice.id && toggleClassFilter(slice.id)}
              selectedName={classFilter ? CLASS_PLURAL[classFilter] : null}
            />
            <DonutAllocationChart title="Alocação ideal, por ativo" data={idealAllocationData} />
          </Card>

          {/* Filtro por tipo: mostra só os ativos da classe escolhida (sincronizado com o gráfico). */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setClassFilter(null)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                classFilter === null
                  ? "border-transparent bg-ink text-canvas"
                  : "border-border bg-surface-2 text-ink-muted hover:text-ink"
              }`}
            >
              Todos ({assets.length})
            </button>
            {classesPresent.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleClassFilter(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  classFilter === c
                    ? "border-transparent bg-ink text-canvas"
                    : "border-border bg-surface-2 text-ink-muted hover:text-ink"
                }`}
              >
                {CLASS_PLURAL[c]} ({countByClass.get(c)})
              </button>
            ))}
          </div>

          {/* Resumo do tipo filtrado: total e fatia da carteira. */}
          {classFilter && (
            <p className="text-sm text-ink-muted">
              {CLASS_PLURAL[classFilter]}: <span className="font-medium text-ink">{formatBRL(valueByClass.get(classFilter) ?? 0)}</span>
              {totalValue > 0 && (
                <> · {formatPercentNumber(((valueByClass.get(classFilter) ?? 0) / totalValue) * 100, 1)} da carteira</>
              )}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {visibleAssets.map((asset) => {
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
                        {asset.ticker && asset.ticker !== asset.name ? ` (${asset.ticker})` : ""}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {asset.quantity !== null && asset.quantity > 0 && `${formatQuantity(asset.quantity)} un · `}
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
