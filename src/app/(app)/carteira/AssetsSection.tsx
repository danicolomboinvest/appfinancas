"use client";

import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

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
import { EQI_SIGNUP_URL } from "@/lib/eqi";


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
  RENDA_FIXA: "var(--color-strat-pos)",
  TESOURO_DIRETO: "var(--color-strat-pos)",
  ACAO: "var(--color-strat-acoes)",
  FII: "var(--color-strat-fiis)",
  FUNDO: "var(--color-strat-outros)",
  CRIPTO: "var(--color-strat-outros)",
  INTERNACIONAL: "var(--color-strat-exterior)",
  OUTRO: "var(--color-strat-outros)",
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
  empresa = false,
}: {
  assets: Asset[];
  goals: { id: string; name: string }[];
  goalNameById: Map<string, string>;
  strategy: StrategySummary;
  /** Perfil Empresa: só o caixa e os ativos, sem estratégia de alocação. */
  empresa?: boolean;
}) {
  const { voz } = useProfileTheme();
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
  const t = voz.titulos;

  // O nome de cada objetivo vem da voz do tema (reserva e liberdade já existiam no catálogo
  // por causa da tela Por Objetivo; aqui só se reaproveita, pra não ter duas fontes).
  const objectiveLabel: Record<string, string> = {
    RESERVA_EMERGENCIA: t.objReserva,
    LIBERDADE_FINANCEIRA: t.objLiberdade,
    META: t.cartObjMeta,
    OUTRO: t.cartObjOutro,
  };

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
      const label = isGoal ? t.cartRotuloMeta(goals.find((g) => g.id === goalId)?.name ?? "") : `"${objectiveLabel[objective]}"`;
      showToast(t.cartVinculados(result.updated, label));
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
          ? t.cartCotacoesNaoAchei(result.updated, result.failed.join(", "))
          : t.cartCotacoesAtualizadas(result.updated),
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
      {/* Herói: o total da carteira. Já foi um número de 52px numa caixa com brilho, e a Dani
          achou gritante e espaçoso. Agora é um cartão baixo: ícone redondo, rótulo, número de
          32px e o chip do lucro na mesma linha. O olho oculta os valores. */}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
              <Briefcase size={20} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {t.cartSuaCarteira(assets.length)}
                </p>
                <button
                  type="button"
                  onClick={() => setHidden((h) => !h)}
                  aria-label={hidden ? t.cartMostrarValores : t.cartOcultarValores}
                  className="text-ink-muted transition-colors hover:text-ink"
                >
                  {hidden ? <EyeOff size={15} strokeWidth={1.9} /> : <Eye size={15} strokeWidth={1.9} />}
                </button>
              </div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <FitText className="text-display font-semibold tracking-tight tabular-nums text-ink">
                  {hidden ? `${currencySymbol(currency)} ••••` : <CountUp value={totalValue} format={formatValue} />}
                </FitText>
                {Math.abs(totalProfit) >= 0.005 && totalInvested > 0 && (
                  <p className={`text-sm tabular-nums ${totalProfit > 0 ? "text-success" : "text-danger"}`}>
                    {t.cartDesdeACompra(`${totalProfit > 0 ? "+" : "−"}${hidden ? `${currencySymbol(currency)} ••••` : money(Math.abs(totalProfit))}`)}
                  </p>
                )}
              </div>
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={16} strokeWidth={2} />
              {t.cartNovoAtivo}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
              <FileUp size={16} strokeWidth={2} />
              {t.cartImportar}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setIrpfOpen(true)}>
              <FileText size={16} strokeWidth={2} />
              {t.cartPrecoMedioIR}
            </Button>
            {hasTickers && (
              <Button type="button" size="sm" variant="secondary" onClick={handleUpdateQuotes} disabled={isUpdatingQuotes}>
                <RefreshCw size={16} strokeWidth={2} className={isUpdatingQuotes ? "animate-spin" : ""} />
                {isUpdatingQuotes ? t.cartAtualizando : t.cartAtualizarCotacoes}
              </Button>
            )}
          </div>
        </div>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          message={voz.titulos.carteiraVazio}
          action={
            <div className="flex flex-col items-center gap-2">
              <p className="text-caption text-ink-faint">{t.carteiraAbrirContaPergunta}</p>
              <a
                href={EQI_SIGNUP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-on-accent shadow-premium-sm transition-all duration-150 ease-out hover:opacity-95"
              >
                {t.carteiraAbrirContaBotao}
              </a>
            </div>
          }
        />
      ) : (
        <>
          {/* Uma rosca e uma régua, não duas roscas. Comparar "atual" e "ideal" em dois
              círculos obriga a pessoa a medir ângulo de cabeça; com o alvo virando tracinho
              na mesma barra, quem está atrás do traço é literalmente o que falta comprar. */}
          <div className={`grid grid-cols-1 gap-7 border-t border-border pt-7 ${empresa ? "" : "sm:grid-cols-2"}`}>
            <div className="flex flex-col gap-3">
              <p className="text-[17px] font-semibold text-ink">{t.cartPorTipo}</p>
              <Donut
                slices={classAllocationData}
                centerLabel={t.cartTotal}
                size={170}
                onSelect={(slice) => slice.id && toggleClassFilter(slice.id)}
                selectedName={classFilter ? CLASS_PLURAL[classFilter] : null}
              />
            </div>
            {!empresa && (
            <div className="flex flex-col gap-3">
              <p className="text-[17px] font-semibold text-ink">{t.cartOndeVoceEsta}</p>
              {strategy.hasStrategy ? (
                <>
                  <BulletBar rows={strategy.bullets} targetHint={t.cartTracinhoAlvo} />
                  <div className="flex flex-wrap items-center gap-2">
                    {strategy.balance.below > 0 && (
                      <span className="rounded-full bg-info-soft px-2.5 py-1 text-caption font-medium text-info">
                        {t.cartAbaixoDoAlvo(strategy.balance.below)}
                      </span>
                    )}
                    {strategy.balance.above > 0 && (
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-caption font-medium text-accent-strong">
                        {t.cartAcimaDoAlvo(strategy.balance.above)}
                      </span>
                    )}
                    {strategy.balance.below === 0 && strategy.balance.above === 0 && (
                      <span className="rounded-full bg-success-soft px-2.5 py-1 text-caption font-medium text-success">
                        {t.cartNaEstrategia}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-xs text-ink-faint">{t.cartDefinaQuanto}</p>
                  <Link href="/carteira/estrategia" className="text-xs font-medium text-accent-strong hover:underline">
                    {t.cartDefinirEstrategia}
                  </Link>
                </div>
              )}
            </div>
            )}
          </div>

          {/* Pra onde vai o próximo aporte: maiores desvios da estratégia (detalhe em Por Objetivo). */}
          {!empresa && strategy.hasStrategy && strategy.suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-muted">{t.cartPraFicarNoAlvo}</span>
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
                {t.cartVerRebalanceamento}
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
                  ? "border-transparent bg-pill text-on-pill"
                  : "border-border bg-surface-2 text-ink-muted hover:text-ink"
              }`}
            >
              {t.cartTodos(assets.length)}
            </button>
            {classesPresent.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleClassFilter(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  classFilter === c
                    ? "border-transparent bg-pill text-on-pill"
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
                <> · {t.cartDaCarteira(formatPercentNumber(((valueByClass.get(classFilter) ?? 0) / totalValue) * 100, 1))}</>
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
                {isBulkPending ? t.cartAplicando : t.cartDefinirObjetivoDos(visibleAssets.length)}
              </option>
              {goals.length > 0 && (
                <optgroup label={t.cartSuasMetas}>
                  {goals.map((g) => (
                    <option key={g.id} value={`goal:${g.id}`}>
                      {g.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t.cartObjetivosGerais}>
                <option value="LIBERDADE_FINANCEIRA">{objectiveLabel.LIBERDADE_FINANCEIRA}</option>
                <option value="RESERVA_EMERGENCIA">{objectiveLabel.RESERVA_EMERGENCIA}</option>
                <option value="OUTRO">{objectiveLabel.OUTRO}</option>
              </optgroup>
            </select>
            </div>
          )}

          {/* No computador, dois ativos por linha (ver EntryList pelo mesmo motivo). */}
          <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4">
            {visibleAssets.map((asset) => {
              const objectiveText =
                asset.objective === "META" && asset.goalId
                  ? t.cartMetaPrefixo(goalNameById.get(asset.goalId) ?? "")
                  : objectiveLabel[asset.objective];
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
                        aria-label={t.cartEditarAria(asset.name)}
                      >
                        <Pencil size={13} strokeWidth={1.75} />
                        {t.cartEditar}
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t.cartNovoAtivo}>
        <AssetForm goals={goals} submitLabel={t.cartAdicionar} onSuccess={() => setCreateOpen(false)} />
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t.cartImportarCarteira}>
        <PortfolioImport onDone={() => setImportOpen(false)} />
      </Modal>

      <Modal open={irpfOpen} onClose={() => setIrpfOpen(false)} title={t.cartPrecoMedioDeclaracao}>
        <IrpfImport onDone={() => setIrpfOpen(false)} />
      </Modal>

      <Modal open={editingAsset !== null} onClose={() => setEditingAsset(null)} title={t.cartEditarAtivo}>
        {editingAsset && (
          <AssetForm
            goals={goals}
            assetId={editingAsset.id}
            submitLabel={t.cartSalvarAlteracoes}
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
