"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import type { ParentCategory } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { Minus, Plus, Sparkles, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { emojiDaCategoria } from "@/lib/profiles/icones";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { Modal } from "@/components/ui/Modal";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { useMoney } from "@/components/money/MoneyProvider";
import {
  PARENT_CATEGORY_COLOR,
  CUSTOM_CATEGORY_ICON_MAP,
  colorForCategorySlice,
  categoryLabel,
  categoryDescription,
  categoryIcon,
} from "@/lib/categories";
import type { BudgetHints } from "@/lib/planning/budget-hints";
import { splitSavings, type SavingsTarget } from "@/lib/planning/savings-split";
import { idealBudgetSplit, COURSE_SAVINGS_PERCENT, EMPRESA_RETENTION_PERCENT, courseShareOf, savingsPercentFor } from "@/lib/planning/ideal-budget";
import { NewCustomCategoryCard } from "./NewCustomCategoryCard";
import { applyAllBudgetsAction, deleteCustomCategoryAction, type AnnualBudgetState } from "./actions";

const initialState: AnnualBudgetState = {};
const STEP = 50;
// 18% = o que a aula "Organização financeira" manda guardar (10% liberdade financeira + 8% sonhos).
const PCT_CHIPS = [10, COURSE_SAVINGS_PERCENT, 20, 30];
// Empresa retém menos e em degraus menores: 10% é a referência de quem está começando, e
// 5% existe porque negócio apertado ainda precisa reter alguma coisa pro DAS e pro caixa.
const PCT_CHIPS_EMPRESA = [5, EMPRESA_RETENTION_PERCENT, 15, 20];

type Cat = { key: string; label: string; description?: string; color: string; icon: LucideIcon; custom: boolean };

function roundStep(v: number): number {
  return Math.max(0, Math.round(v / STEP) * STEP);
}

/**
 * "Vamos montar seu orçamento": três passos na ordem em que o dinheiro anda — quanto entra,
 * quanto guarda, como divide o resto. Grava exatamente o que o formulário antigo gravava
 * (mesmos campos, mesma action); mudou só o jeito de preencher: o app sugere o que já sabe
 * pelos lançamentos, guardar vira porcentagem, e dividir vira uma barra que enche.
 */
export function BudgetWizard({
  year,
  plan,
  parentCategories,
  customCategories,
  hints,
  hasPlan,
  savingsTargets = [],
}: {
  year: number;
  plan: { plannedIncome: number; plannedInvestment: number };
  parentCategories: { key: ParentCategory; label: string; description: string; defaultValue: number }[];
  customCategories: { id: string; name: string; icon: string; defaultValue: number }[];
  hints: BudgetHints;
  /** Já existe plano: abre no resumo, e "ajustar" volta pros passos. */
  hasPlan: boolean;
  /** Reserva e metas abertas, pra dizer no passo 3 pra onde vai o que se guarda. */
  savingsTargets?: SavingsTarget[];
}) {
  const money = useMoney();
  const { kind, empresa, voz } = useProfileTheme();
  const t = voz.titulos;
  const [state, formAction, isPending] = useActionState(applyAllBudgetsAction, initialState);
  useSuccessToast(isPending, state.error, t.formOrcSalvo);
  // A referência de quanto guardar muda com o perfil: 18% da aula pra pessoa, 10% de
  // retenção pra empresa. Os chips e as notas de rodapé seguem o mesmo número.
  const savingsPct = savingsPercentFor(kind);
  const pctChips = empresa ? PCT_CHIPS_EMPRESA : PCT_CHIPS;

  // Nome, descrição e ícone vêm do PERFIL, não da prop: num perfil Empresa, MORADIA é
  // "Estrutura" e SAUDE é "Equipe e pró-labore". A prop continua trazendo a chave e o valor
  // já planejado; o rótulo de pessoa física que ela carrega só vale pra pessoa física.
  const cats: Cat[] = useMemo(
    () => [
      ...parentCategories.map((c) => ({
        key: c.key,
        label: categoryLabel(kind, c.key),
        description: categoryDescription(kind, c.key),
        color: PARENT_CATEGORY_COLOR[c.key],
        icon: categoryIcon(kind, c.key),
        custom: false,
      })),
      ...customCategories.map((c) => ({
        key: c.id,
        label: c.name,
        color: colorForCategorySlice({ kind: "custom", value: c.id }),
        icon: CUSTOM_CATEGORY_ICON_MAP[c.icon] ?? Tag,
        custom: true,
      })),
    ],
    [parentCategories, customCategories, kind],
  );

  const [step, setStep] = useState<1 | 2 | 3>(hasPlan ? 3 : 1);
  const [income, setIncome] = useState(plan.plannedIncome);
  const [investment, setInvestment] = useState(plan.plannedInvestment);
  const [customPct, setCustomPct] = useState(false);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries([
      ...parentCategories.map((c) => [c.key, c.defaultValue]),
      ...customCategories.map((c) => [c.id, c.defaultValue]),
    ]),
  );

  const toSpend = Math.max(0, income - investment);
  const distributed = cats.reduce((sum, c) => sum + (values[c.key] ?? 0), 0);
  const left = toSpend - distributed;
  const free = income - investment - distributed;
  const activePct = income > 0 ? Math.round((investment / income) * 100) : 0;
  const savings = useMemo(() => splitSavings(investment, savingsTargets), [investment, savingsTargets]);

  function setValue(key: string, v: number) {
    setValues((prev) => ({ ...prev, [key]: Math.max(0, Math.round(v * 100) / 100) }));
  }

  /**
   * Divide o que sobra na proporção de referência do perfil (ideal-budget.ts: a aula pra
   * pessoa, a régua da pequena empresa pra EMPRESA), não na média dos meses da própria pessoa: quem está começando não tem meses, e quem já estoura
   * uma categoria receberia de volta a sugestão de estourar igual. As categorias criadas pela
   * própria pessoa ficam com o valor que já têm e saem do bolo antes da divisão.
   */
  function suggest() {
    const reserved = customCategories.reduce((sum, c) => sum + (values[c.id] ?? 0), 0);
    const ideal = idealBudgetSplit(toSpend, income, { reserved, kind });
    setValues((prev) => ({ ...prev, ...ideal }));
  }
  function copyLastMonth() {
    setValues(Object.fromEntries(cats.map((c) => [c.key, roundStep(hints.lastMonthByCategory[c.key] ?? 0)])));
  }

  const hasHistory = Object.values(hints.averageByCategory).some((v) => v > 0);

  const header = (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-strong">{t.formOrcPasso(step, 3)}</span>
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((s) => (
          <span key={s} className={`h-1 w-7 rounded-full ${s <= step ? "bg-accent" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="plannedIncome" value={income} />
      <input type="hidden" name="plannedInvestment" value={investment} />
      {parentCategories.map((c) => (
        <input key={c.key} type="hidden" name={`plannedAmount_${c.key}`} value={values[c.key] ?? 0} />
      ))}
      {customCategories.map((c) => (
        <span key={c.id}>
          <input type="hidden" name="customCategoryId" value={c.id} />
          <input type="hidden" name={`plannedAmount_custom_${c.id}`} value={values[c.id] ?? 0} />
        </span>
      ))}
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      {step === 1 && (
        <>
          {header}
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">{t.formOrcTitulo}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t.formOrcSub}</p>
          </div>

          <Card className="flex flex-col gap-3 p-4">
            <p className="text-[15px] font-semibold text-ink">{t.formOrcQuantoEntra}</p>
            <CurrencyField
              label={t.formOrcRenda}
              name="_income"
              defaultValue={income || undefined}
              onValueChange={setIncome}
              suggestion={
                hints.lastMonthIncome > 0 && hints.lastMonthIncome !== income
                  ? { value: hints.lastMonthIncome, label: t.formOrcRendaSugestao(hints.lastMonthLabel, money(hints.lastMonthIncome, { round: true })) }
                  : undefined
              }
            />
          </Card>

          <Card className="flex flex-col gap-3 p-4">
            <p className="text-[15px] font-semibold text-ink">{t.formOrcQuantoGuardar}</p>
            <div className="flex flex-wrap gap-2">
              {pctChips.map((pct) => {
                const on = !customPct && income > 0 && activePct === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setCustomPct(false);
                      // Valor exato, não arredondado de 50 em 50: 18% de 16.000 é 2.880, e
                      // 2.900 deixaria a divisão da referência 20 reais curta no passo seguinte.
                      setInvestment(Math.round((income * pct) / 100));
                    }}
                    className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                      on ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"
                    }`}
                  >
                    {pct}%{income > 0 ? ` · ${money(Math.round((income * pct) / 100), { round: true })}` : ""}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomPct(true)}
                className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  customPct ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"
                }`}
              >
                {t.formOrcOutro}
              </button>
            </div>
            {customPct && (
              <CurrencyField label={t.formOrcGuardarPorMes} name="_investment" defaultValue={investment || undefined} onValueChange={setInvestment} />
            )}
            {/* Pessoa: "18%, sendo 10% de liberdade financeira" (os 8 restantes são os sonhos).
                Empresa: a camada da voz ignora os números e explica o que é retenção. */}
            <p className="text-caption leading-relaxed text-ink-faint">
              {t.formOrcCursoNota(savingsPct, empresa ? savingsPct : savingsPct - 8)}
            </p>
          </Card>

          <div className="rounded-2xl border border-success/30 bg-success-soft/40 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-success">{t.formOrcSobraTitulo}</p>
            <p className="text-3xl font-extrabold tracking-tight text-success">{money(toSpend, { round: true })}</p>
            <p className="text-caption text-ink-muted">{t.formOrcSobraSub(money(investment, { round: true }))}</p>
          </div>

          <Button type="button" onClick={() => setStep(2)} disabled={income <= 0} className="w-full">
            {t.formOrcDividir(money(toSpend, { round: true }))}
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          {header}
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">{t.formOrcDividaTitulo(money(toSpend, { round: true }))}</h2>

          <Card className="flex flex-col gap-2 p-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-muted">{t.formOrcDistribuido}</span>
              <b className="tabular-nums text-ink">{money(distributed, { round: true })}</b>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
              {cats.map((c) => (
                <span
                  key={c.key}
                  className="h-full transition-[width] duration-300"
                  style={{ width: `${toSpend > 0 ? Math.min(100, ((values[c.key] ?? 0) / toSpend) * 100) : 0}%`, backgroundColor: c.color }}
                />
              ))}
            </div>
            <p className={`text-sm font-semibold ${left >= 0 ? "text-success" : "text-danger"}`}>
              {left >= 0 ? t.formOrcSobram(money(left, { round: true })) : t.formOrcPassou(money(-left, { round: true }))}
            </p>
          </Card>

          {/* "Sugerir" não depende mais de ter histórico: é justamente quem está começando que
              não sabe quanto pôr em cada coisa. "Copiar" continua só pra quem tem o mês passado. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={suggest}
                disabled={toSpend <= 0}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3 py-2 text-[13px] font-semibold text-accent-strong disabled:opacity-40"
              >
                <Sparkles size={14} /> {t.formOrcSugerir}
              </button>
              {hasHistory && (
                <button
                  type="button"
                  onClick={copyLastMonth}
                  className="flex-1 rounded-full border border-border-strong bg-surface-2 px-3 py-2 text-[13px] font-semibold text-ink-muted hover:text-ink"
                >
                  {t.formOrcCopiar(hints.lastMonthLabel)}
                </button>
              )}
            </div>
            <p className="text-caption text-ink-faint">
              {t.formOrcSugestaoNota(
                Math.round(courseShareOf("MORADIA", kind) * 100),
                Math.round(courseShareOf("ALIMENTACAO", kind) * 100),
                Math.round(courseShareOf("SAUDE", kind) * 100),
                savingsPct,
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cats.map((c) => (
              <CategoryTile
                key={c.key}
                cat={c}
                value={values[c.key] ?? 0}
                lastMonth={hints.lastMonthByCategory[c.key] ?? 0}
                lastMonthLabel={hints.lastMonthLabel}
                onChange={(v) => setValue(c.key, v)}
              />
            ))}
            <NewCustomCategoryCard />
          </div>
          <p className="text-caption leading-relaxed text-ink-faint">{t.formOrcCustomNota}</p>

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="button" onClick={() => setStep(3)} className="w-full sm:w-auto">
              {t.formOrcVerPlano}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep(1)} className="w-full sm:w-auto">
              {t.formVoltar}
            </Button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          {header}
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">{hasPlan ? t.formOrcSeuPlano(year) : t.formOrcProntoPlano(year)}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t.formOrcDeCadaAntes} <b className="text-ink">{money(100, { round: true })}</b> {t.formOrcDeCadaDepois}
            </p>
          </div>

          <div className="flex h-5 overflow-hidden rounded-full bg-surface-2">
            {income > 0 && <span className="h-full bg-success" style={{ width: `${(investment / income) * 100}%` }} />}
            {income > 0 &&
              cats.map((c) => (
                <span key={c.key} className="h-full" style={{ width: `${((values[c.key] ?? 0) / income) * 100}%`, backgroundColor: c.color }} />
              ))}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] text-ink sm:grid-cols-3 lg:grid-cols-4">
            <Legend color="var(--color-success)" label={t.formOrcLegGuardados(share(investment, income))} />
            {cats
              .filter((c) => (values[c.key] ?? 0) > 0)
              .map((c) => (
                <Legend key={c.key} color={c.color} label={t.formOrcLegCategoria(share(values[c.key] ?? 0, income), c.label.toLowerCase())} />
              ))}
            <Legend color="var(--color-surface-2)" label={t.formOrcLegLivres(share(Math.max(0, free), income))} />
          </div>

          <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 px-4 py-4">
            <p className="text-xs font-bold text-accent-strong">{t.formOrcFimDoAno}</p>
            <p className="text-2xl font-extrabold tracking-tight text-ink">{t.formOrcFimDoAnoValor(money(investment * hints.monthsLeftInYear, { round: true }))}</p>
            <p className="text-caption leading-relaxed text-ink-muted">
              {t.formOrcFimDoAnoSub(money(investment, { round: true }), hints.monthsLeftInYear)}
            </p>
          </div>

          {savings.slices.length > 0 && savingsTargets.length > 0 && (
            <Card className="flex flex-col gap-2 p-4">
              <p className="text-sm font-semibold text-ink">{t.formOrcPraOnde}</p>
              <ul className="flex flex-col gap-1 text-sm">
                {savings.slices.map((s) => (
                  <li key={s.id} className="flex items-baseline gap-2">
                    <b className="shrink-0 tabular-nums text-ink">{money(s.amount, { round: true })}</b>
                    <span className="min-w-0 text-ink-muted">→ {s.name}</span>
                  </li>
                ))}
              </ul>
              <p className="text-caption text-ink-faint">{t.formOrcPraOndeNota}</p>
            </Card>
          )}

          <Card className="flex flex-col gap-2 p-4 text-sm">
            <Row label={t.formOrcEntra} value={money(income, { round: true })} />
            <Row label={t.formOrcGuarda} value={money(investment, { round: true })} tone="text-success" />
            <Row label={t.formOrcGasta(cats.filter((c) => (values[c.key] ?? 0) > 0).length)} value={money(distributed, { round: true })} />
            <div className="border-t border-border pt-2">
              <Row label={t.formOrcFicaLivre} value={money(free, { round: true })} tone={free < 0 ? "text-danger" : undefined} />
            </div>
            {free < 0 && <p className="text-caption text-danger">{t.formOrcEstourou}</p>}
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? t.formSalvando : t.formOrcSalvar}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep(2)} className="w-full sm:w-auto">
              {t.formOrcAjustar}
            </Button>
            {hasPlan && (
              <Button type="button" variant="ghost" onClick={() => setStep(1)} className="w-full sm:w-auto">
                {t.formOrcRendaEAporte}
              </Button>
            )}
          </div>
        </>
      )}
    </form>
  );
}

function share(part: number, whole: number): string {
  if (whole <= 0) return "0";
  return String(Math.round((part / whole) * 100));
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-muted">{label}</span>
      <b className={`tabular-nums ${tone ?? "text-ink"}`}>{value}</b>
    </div>
  );
}

/** Um quadradinho por categoria: valor grande, o que saiu mês passado embaixo, e + / − de 50 em 50. */
function CategoryTile({
  cat,
  value,
  lastMonth,
  lastMonthLabel,
  onChange,
}: {
  cat: Cat;
  value: number;
  lastMonth: number;
  lastMonthLabel: string;
  onChange: (v: number) => void;
}) {
  const money = useMoney();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const Icon = cat.icon;
  const { key: tema, voz } = useProfileTheme();
  const t = voz.titulos;

  return (
    <Card className="flex flex-col gap-2 p-3" style={{ borderTop: `3px solid ${cat.color}` }}>
      <div className="flex items-center gap-2">
        <CategoryIcon icon={Icon} color={cat.color} size={36} emoji={cat.custom ? emojiDaCategoria(tema, { kind: "custom" }) : emojiDaCategoria(tema, { kind: "parent", value: cat.key })} />
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{cat.label}</p>
        {cat.custom && (
          <button type="button" onClick={() => setConfirmOpen(true)} aria-label={`Apagar categoria ${cat.label}`} className="text-ink-faint hover:text-danger">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {editing ? (
        <CurrencyInputControlled
          label={t.formOrcPorMes}
          value={value}
          onChange={(v) => onChange(v ?? 0)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`text-left text-xl font-extrabold tabular-nums tracking-tight ${value > 0 ? "text-ink" : "text-ink-faint"}`}
          aria-label={`Editar valor de ${cat.label}`}
        >
          {money(value, { round: true })}
        </button>
      )}
      <p className="text-[11px] text-ink-faint">
        {lastMonth > 0 ? t.formOrcMesPassado(lastMonthLabel.slice(0, 3), money(lastMonth, { round: true })) : t.formOrcSemGasto}
      </p>
      <div className="mt-auto flex gap-1.5">
        <button type="button" onClick={() => onChange(Math.max(0, value - STEP))} aria-label={`Menos ${STEP} em ${cat.label}`} className="flex flex-1 items-center justify-center rounded-lg border border-border-strong bg-surface-2 py-1.5 text-ink-muted hover:text-ink">
          <Minus size={16} />
        </button>
        <button type="button" onClick={() => onChange(value + STEP)} aria-label={`Mais ${STEP} em ${cat.label}`} className="flex flex-1 items-center justify-center rounded-lg border border-border-strong bg-surface-2 py-1.5 text-ink-muted hover:text-ink">
          <Plus size={16} />
        </button>
      </div>

      {cat.custom && (
        <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t.formOrcApagarTitulo}>
          <p className="text-sm text-ink-muted">
            {t.formOrcApagarAntes} <span className="font-medium text-ink">{cat.label}</span>{t.formOrcApagarDepois}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              {t.formCancelar}
            </Button>
            <Button type="button" variant="danger" size="sm" disabled={isDeleting} onClick={() => startDelete(async () => { await deleteCustomCategoryAction(cat.key); })}>
              {isDeleting ? t.formOrcApagando : t.formOrcApagar}
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
