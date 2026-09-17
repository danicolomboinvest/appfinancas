"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Briefcase, Eye, EyeOff, FileText, FileUp, Pencil, Plus, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FitText } from "@/components/ui/FitText";
import { CountUp } from "@/components/ui/CountUp";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast-context";
import { Donut } from "@/components/charts/Donut";
import { BulletBar, type BulletRow } from "@/components/charts/BulletBar";
import { PortfolioImport } from "@/components/import/PortfolioImport";
import { IrpfImport } from "@/components/import/IrpfImport";
import { DeleteAssetButton } from "./DeleteAssetButton";
import { AssetForm } from "./AssetForm";
import { updatePortfolioQuotesAction } from "./quotes-actions";
import { bulkSetObjectiveAction } from "./actions";
import { formatPercentNumber } from "@/lib/format";
import { useMoney, useCurrency } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";


const CLASS_LABEL: Record<string, string> = {
  RENDA_FIXA: "Renda Fixa",
  ACAO: "Ação",
  FII: "FII",
  TESOURO_DIRETO: "Tesouro Direto",
  FUNDO: "Fundo",
  CRIPTO: "Cripto",
  INTERNACIONAL: "Internacional",
  OUTRO: "Outro",
};

/** Mesma paleta de STRATEGY_ASSET_CLASS_COLOR (src/lib/portfolio/strategy.ts), duplicada aqui
 * pra não puxar aquele módulo (que importa Prisma) pro bundle do cliente, dá o mesmo golpe de
 * vista de cor consistente com o donut acima, sem precisar do mapeamento fino por indexador.
 * INTERNACIONAL usa a cor de EXTERIOR (mesmo bucket na Estratégia). */
const CLASS_COLOR: Record<string, string> = {
  RENDA_FIXA: "#4FA3C7",
  TESOURO_DIRETO: "#4FA3C7",
  ACAO: "#E0A85F",
  FII: "#6D8BD0",
  FUNDO: "#9AA0A6",
  CRIPTO: "#9AA0A6",
  INTERNACIONAL: "#D98C6A",
  OUTRO: "#9AA0A6",
};

/** Rótulo no plural pros filtros/fatias ("Ações", "FIIs"…). */
const CLASS_PLURAL: Record<string, string> = {
  ACAO: "Ações",
  FII: "FIIs",
  FUNDO: "Fundos",
  RENDA_FIXA: "Renda Fixa",
  TESOURO_DIRETO: "Tesouro Direto",
  CRIPTO: "Cripto",
  INTERNACIONAL: "Internacional",
  OUTRO: "Outros",
};

/** Ordem fixa das classes no gráfico/filtros (cores estáveis entre visitas). */
const CLASS_ORDER = ["ACAO", "FII", "FUNDO", "INTERNACIONAL", "RENDA_FIXA", "TESOURO_DIRETO", "CRIPTO", "OUTRO"];

/** Rótulo curto do indexador de renda fixa, mostrado na linha do ativo. */
const FI_LABEL: Record<string, string> = { POS_FIXADO: "Pós-fixado", IPCA: "IPCA+", PREFIXADO: "Prefixado" };

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
  investedValue: number | null;
  fixedIncomeIndex: string | null;
  currentValue: number;
};

/** Resumo da Estratégia da Carteira (a alocação ideal): alvos por classe + até 3 sugestões
 * de rebalanceamento fora da tolerância, prontos pra exibir. */
export type StrategySummary = {
  hasStrategy: boolean;
  /** Uma linha por classe: preenchimento = onde a carteira está, tracinho = o alvo. */
  bullets: BulletRow[];
  /** Quantas classes estão abaixo/acima do alvo — o veredito em uma linha. */
  balance: { below: number; above: number };
  suggestions: { label: string; amount: number }[];
};

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
}

/** Lucro/prejuízo = valor atual − investido. Null quando não dá pra calcular. */
function profitOf(asset: { investedValue: number | null; currentValue: number }): number | null {
  if (asset.investedValue === null || asset.investedValue <= 0) return null;
  return asset.currentValue - asset.investedValue;
}

/** Lista de ativos + criação/edição em modal, a lista vem primeiro, o formulário só aparece
 * quando a pessoa pede (botão "+ Novo ativo" ou "Editar" em cada linha). */
export function AssetsSection({
  assets,
  goals,
  goalNameById,
  strategy,
}: {
  assets: Asset[];
  goals: { id: string; name: string }[];
  goalNameById: Map<string, string>;
  strategy: StrategySummary;
}) {
  const currency = useCurrency();
  const formatValue = useMoney();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [irpfOpen, setIrpfOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false); // botão de olho: oculta os valores em dinheiro
  const [isUpdatingQuotes, startQuotesTransition] = useTransition();
  const [isBulkPending, startBulkTransition] = useTransition();
  const { showToast } = useToast();

  /** Define o objetivo de todos os ativos do tipo filtrado de uma vez. O valor pode ser um
   * objetivo fixo (RESERVA/LIBERDADE/OUTRO) ou "goal:<id>" pra vincular a uma meta real. */
  function handleBulkObjective(value: string) {
    if (!classFilter) return;
    startBulkTransition(async () => {
      const isGoal = value.startsWith("goal:");
      const goalId = isGoal ? value.slice(5) : undefined;
      const objective = (isGoal ? "META" : value) as "RESERVA_EMERGENCIA" | "LIBERDADE_FINANCEIRA" | "OUTRO" | "META";
      const result = await bulkSetObjectiveAction(classFilter, objective, goalId);
      if (!result.ok) return showToast(result.error);
      const label = isGoal ? `meta "${goals.find((g) => g.id === goalId)?.name ?? ""}"` : `"${OBJECTIVE_LABEL[objective]}"`;
      showToast(`${result.updated} ativos vinculados a ${label}.`);
    });
  }

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
  // Lucro geral: só considera ativos com investido conhecido (evita distorcer o %).
  const totalInvested = assets.reduce((sum, a) => sum + (a.investedValue !== null && a.investedValue > 0 ? a.investedValue : 0), 0);
  const totalProfit = assets.reduce((sum, a) => sum + (profitOf(a) ?? 0), 0);
  /** Formata na moeda escolhida, ou "•••• " quando o olho está fechado. */
  const money = (v: number) => (hidden ? `${currencySymbol(currency)} ••••` : formatValue(v));

  // Carteira atual agrupada por TIPO (Ações, FIIs, Fundos…), com dezenas de ativos, uma
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
    value: valueByClass.get(c) ?? 0,
    color: CLASS_COLOR[c] ?? "var(--color-ink-faint)",
  }));
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
      {/* Herói: o total da carteira é o número-herói. O olho oculta os valores em R$. */}
      {/* Uma superfície só — mesmo tratamento do patrimônio na Visão Geral e do destaque do
          mês no Fluxo. Retângulo arredondado dentro de outro, quase da mesma cor, era o que
          mais envelhecia a tela. */}
      <div className="glow-stage rounded-3xl border border-border p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-label font-semibold uppercase tracking-[0.11em] text-ink-muted">
                  Sua carteira · {assets.length} ativo{assets.length === 1 ? "" : "s"}
                </p>
                <button
                  type="button"
                  onClick={() => setHidden((h) => !h)}
                  aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
                  className="text-ink-muted transition-colors hover:text-ink"
                >
                  {hidden ? <EyeOff size={15} strokeWidth={1.9} /> : <Eye size={15} strokeWidth={1.9} />}
                </button>
              </div>
              <div className="mt-1">
                <FitText className="text-display font-bold tracking-tight tabular-nums text-ink">
                  {hidden ? `${currencySymbol(currency)} ••••` : <CountUp value={totalValue} format={formatValue} />}
                </FitText>
              </div>
              {Math.abs(totalProfit) >= 0.005 && totalInvested > 0 && (
                <p className={`mt-1 text-sm tabular-nums ${totalProfit > 0 ? "text-success" : "text-danger"}`}>
                  {totalProfit > 0 ? "+" : "−"}{hidden ? `${currencySymbol(currency)} ••••` : money(Math.abs(totalProfit))} desde a compra
                </p>
              )}
            </div>
            {Math.abs(totalProfit) >= 0.005 && totalInvested > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${
                  totalProfit > 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                }`}
              >
                {totalProfit > 0 ? "▲" : "▼"} {totalProfit > 0 ? "+" : "−"}
                {formatPercentNumber(Math.abs((totalProfit / totalInvested) * 100), 1)}
              </span>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={16} strokeWidth={2} />
              Novo ativo
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
              <FileUp size={16} strokeWidth={2} />
              Importar
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setIrpfOpen(true)}>
              <FileText size={16} strokeWidth={2} />
              Preço médio (IR)
            </Button>
            {hasTickers && (
              <Button type="button" size="sm" variant="secondary" onClick={handleUpdateQuotes} disabled={isUpdatingQuotes}>
                <RefreshCw size={16} strokeWidth={2} className={isUpdatingQuotes ? "animate-spin" : ""} />
                {isUpdatingQuotes ? "Atualizando..." : "Atualizar cotações"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          message="Nenhum ativo cadastrado ainda. Adicione o primeiro para acompanhar sua carteira aqui."
        />
      ) : (
        <>
          {/* Uma rosca e uma régua, não duas roscas. Comparar "atual" e "ideal" em dois
              círculos obriga a pessoa a medir ângulo de cabeça; com o alvo virando tracinho
              na mesma barra, quem está atrás do traço é literalmente o que falta comprar. */}
          <div className="grid grid-cols-1 gap-7 border-t border-border pt-7 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="text-[17px] font-semibold text-ink">Carteira atual, por tipo</p>
              <Donut
                slices={classAllocationData}
                centerLabel="Total"
                size={170}
                onSelect={(slice) => slice.id && toggleClassFilter(slice.id)}
                selectedName={classFilter ? CLASS_PLURAL[classFilter] : null}
              />
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[17px] font-semibold text-ink">Onde você está × sua estratégia</p>
              {strategy.hasStrategy ? (
                <>
                  <BulletBar
                    rows={strategy.bullets}
                    targetHint="O tracinho é o seu alvo. Quem está atrás dele é o que comprar no próximo aporte."
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {strategy.balance.below > 0 && (
                      <span className="rounded-full bg-info-soft px-2.5 py-1 text-caption font-medium text-info">
                        {strategy.balance.below} abaixo do alvo
                      </span>
                    )}
                    {strategy.balance.above > 0 && (
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-caption font-medium text-accent-strong">
                        {strategy.balance.above} acima do alvo
                      </span>
                    )}
                    {strategy.balance.below === 0 && strategy.balance.above === 0 && (
                      <span className="rounded-full bg-success-soft px-2.5 py-1 text-caption font-medium text-success">
                        Carteira na estratégia
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-xs text-ink-faint">
                    Defina quanto quer ter em cada tipo e compare com a carteira atual.
                  </p>
                  <Link href="/carteira/estrategia" className="text-xs font-medium text-accent-strong hover:underline">
                    Definir estratégia →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Pra onde vai o próximo aporte: maiores desvios da estratégia (detalhe em Por Objetivo). */}
          {strategy.hasStrategy && strategy.suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-muted">Pra ficar no alvo:</span>
              {strategy.suggestions.map((s) => (
                <span
                  key={s.label}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                    s.amount >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                  }`}
                >
                  {s.amount >= 0 ? "+" : "−"} {money(Math.abs(s.amount))} {s.label}
                </span>
              ))}
              <Link href="/carteira/por-objetivo" className="text-xs text-accent-strong hover:underline">
                Ver rebalanceamento →
              </Link>
            </div>
          )}

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
            <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-muted">
              {CLASS_PLURAL[classFilter]}: <span className="font-medium text-ink">{money(valueByClass.get(classFilter) ?? 0)}</span>
              {totalValue > 0 && (
                <> · {formatPercentNumber(((valueByClass.get(classFilter) ?? 0) / totalValue) * 100, 1)} da carteira</>
              )}
              {(() => {
                const profit = visibleAssets.reduce((sum, a) => sum + (profitOf(a) ?? 0), 0);
                if (Math.abs(profit) < 0.005) return null;
                return (
                  <>
                    {" · "}
                    <span className={profit > 0 ? "text-success" : "text-danger"}>
                      {profit > 0 ? "+" : "−"}{hidden ? `${currencySymbol(currency)} ••••` : money(Math.abs(profit))}
                    </span>
                  </>
                );
              })()}
            </p>
            <select
              value=""
              disabled={isBulkPending}
              onChange={(e) => {
                if (e.target.value) handleBulkObjective(e.target.value);
              }}
              className="rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-muted focus:border-accent focus:outline-none"
            >
              <option value="" disabled>
                {isBulkPending ? "Aplicando…" : `Definir objetivo dos ${visibleAssets.length}…`}
              </option>
              {goals.length > 0 && (
                <optgroup label="Suas metas">
                  {goals.map((g) => (
                    <option key={g.id} value={`goal:${g.id}`}>
                      {g.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Objetivos gerais">
                <option value="LIBERDADE_FINANCEIRA">Liberdade financeira</option>
                <option value="RESERVA_EMERGENCIA">Reserva de emergência</option>
                <option value="OUTRO">Outro</option>
              </optgroup>
            </select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {visibleAssets.map((asset) => {
              const objectiveText =
                asset.objective === "META" && asset.goalId
                  ? `Meta: ${goalNameById.get(asset.goalId) ?? ""}`
                  : OBJECTIVE_LABEL[asset.objective];
              const expanded = expandedId === asset.id;
              return (
                <Card key={asset.id} className="p-0">
                  {/* A linha toda é clicável: toque abre as ações (Editar/Remover) sem poluir a lista. */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : asset.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Badge tone="neutral">
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ background: CLASS_COLOR[asset.assetClass] }}
                        />
                        {CLASS_LABEL[asset.assetClass]}
                      </Badge>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {asset.name}
                          {asset.ticker && asset.ticker !== asset.name ? ` (${asset.ticker})` : ""}
                        </p>
                        <p className="truncate text-xs text-ink-faint">
                          {asset.quantity !== null && asset.quantity > 0 && `${formatQuantity(asset.quantity)} un · `}
                          {asset.fixedIncomeIndex && `${FI_LABEL[asset.fixedIncomeIndex]} · `}
                          {objectiveText}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-ink">{money(asset.currentValue)}</p>
                      {(() => {
                        const profit = profitOf(asset);
                        if (profit === null || Math.abs(profit) < 0.005) return null;
                        const pct = (profit / (asset.investedValue as number)) * 100;
                        return (
                          <p className={`text-xs tabular-nums ${profit > 0 ? "text-success" : "text-danger"}`}>
                            {profit > 0 ? "+" : "−"}{hidden ? `${currencySymbol(currency)} ••••` : formatValue(Math.abs(profit), { round: true })} ({profit > 0 ? "+" : "−"}{formatPercentNumber(Math.abs(pct), 1)})
                          </p>
                        );
                      })()}
                    </div>
                  </button>

                  {expanded && (
                    <div className="flex items-center justify-end gap-4 border-t border-border px-3 py-2">
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
                  )}
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

      <Modal open={irpfOpen} onClose={() => setIrpfOpen(false)} title="Preço médio pela declaração de IR">
        <IrpfImport onDone={() => setIrpfOpen(false)} />
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
              quantity: editingAsset.quantity ?? undefined,
              investedValue: editingAsset.investedValue ?? undefined,
              assetClass: editingAsset.assetClass,
              objective: editingAsset.objective,
              goalId: editingAsset.goalId ?? undefined,
              currentValue: editingAsset.currentValue,
              fixedIncomeIndex: editingAsset.fixedIncomeIndex ?? undefined,
            }}
          />
        )}
      </Modal>
    </div>
  );
}
