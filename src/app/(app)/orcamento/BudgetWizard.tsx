"use client";

import { LapisDaCategoria } from "@/components/categorias/LapisDaCategoria";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ParentCategory } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { Pencil, Check, ChevronLeft, FileUp, Minus, PieChart, Plus, Repeat, Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { emojiDaCategoria } from "@/lib/profiles/icones";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { CUSTOM_CATEGORY_ICON_MAP, colorForCategorySlice, emojiEscolhido, categoryLabel, categoryIcon, categoriaOculta } from "@/lib/categories";
import type { BudgetHints } from "@/lib/planning/budget-hints";
import { MESES_MINIMOS_DO_PADRAO } from "@/lib/planning/padrao-orcamento";
import { EVENTO_IMPORTAR } from "@/components/shell/registrar-eventos";
import type { SavingsTarget } from "@/lib/planning/savings-split";
import { courseShareOf, savingsPercentFor } from "@/lib/planning/ideal-budget";
import { divisaoDoGuardar, fecharExato, porcentagensQueSomam100 } from "@/lib/planning/fechar-plano";
import { fatiasDoPlano } from "@/lib/planning/cores-do-plano";
import { NewCustomCategoryCard } from "./NewCustomCategoryCard";
import { applyAllBudgetsAction, type AnnualBudgetState } from "./actions";
import { useVoltarAoTopo } from "@/components/ui/useVoltarAoTopo";
import { PLANO_SALVO } from "@/components/budget/EditarPlano";

const initialState: AnnualBudgetState = {};
const STEP = 50;
// Os cinco blocos do "Quanto você quer guardar?" (protótipo). 18% é a aula: 10% liberdade + 8% sonhos.
const PCTS = [10, 15, 18, 20, 25];
// Empresa retém menos: 10% é a referência de quem está começando.
const PCTS_EMPRESA = [5, 10, 15, 20, 25];
// As fixas ficam como estão no "Usar o meu padrão"; a sobra do arredondamento nunca cai nelas.
const FIXAS: string[] = ["MORADIA", "EDUCACAO"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

type Cat = { key: string; label: string; color: string; icon: LucideIcon; custom: boolean; iconName?: string };
type Passo = 1 | 2 | 3 | "monta" | "pronto";

const botao = "flex min-h-[54px] w-full items-center justify-center rounded-full bg-ink px-5 text-[17px] font-semibold text-canvas disabled:opacity-40";
const pergunta = "text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink";

/**
 * "Montar o plano" (protótipo aprovado, tema-padrao.html, 12/10/2026): uma pergunta por tela, na
 * ordem em que o dinheiro anda. 1) quanto entra, valor grande com − e + e três atalhos;
 * 2) quanto guardar, em cinco blocos (18% = 10% liberdade financeira + 8% sonhos);
 * 3) como dividir o resto, com "Sugerir para mim" e "Usar o meu padrão", e as duas fecham exato
 * no que há para dividir (lib/planning/fechar-plano.ts); depois "Montando o seu plano" e o
 * "Seu plano está pronto", com "Quando vale?" e "Usar este plano". Grava os mesmos campos da
 * mesma action de antes; ao salvar a janela fecha e o Orçamento mostra o "Seu plano".
 */
export function BudgetWizard({
  year,
  profileId,
  plan,
  parentCategories,
  customCategories,
  hints,
  hasPlan,
  mesDeAgora,
  aoVoltarDoInicio,
}: {
  year: number;
  /** Perfil com que a tela foi montada: o "Salvar" recusa se o ativo já for outro. */
  profileId: string;
  plan: { plannedIncome: number; plannedInvestment: number };
  parentCategories: { key: ParentCategory; label: string; description: string; defaultValue: number }[];
  customCategories: { id: string; name: string; icon: string; defaultValue: number }[];
  hints: BudgetHints;
  hasPlan: boolean;
  /** Mantido por compatibilidade: o destino do que se guarda aparece na Carteira. */
  savingsTargets?: SavingsTarget[];
  /** Mês de agora (1–12) quando o plano é do ano corrente: liga o "Quando vale?". */
  mesDeAgora?: number;
  /** Aberto a partir do "Seu plano": o Voltar do passo 1 volta para ele. */
  aoVoltarDoInicio?: () => void;
}) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const simbolo = currencySymbol(useCurrency());
  const { key: tema, kind, empresa, voz, categorias } = useProfileTheme();
  const t = voz.titulos;
  const [state, formAction, isPending] = useActionState(async (anterior: AnnualBudgetState, dados: FormData): Promise<AnnualBudgetState> => {
    try {
      return await applyAllBudgetsAction(anterior, dados);
    } catch {
      return { error: "Não deu para confirmar se salvou. Confira a internet e toque em Salvar de novo." };
    }
  }, initialState);
  useSuccessToast(isPending, state.error, t.formOrcSalvo);
  // Salvou sem erro: avisa a janela para fechar; o Orçamento já volta com o "Seu plano".
  const estavaSalvando = useRef(false);
  useEffect(() => {
    if (estavaSalvando.current && !isPending && !state.error) window.dispatchEvent(new Event(PLANO_SALVO));
    estavaSalvando.current = isPending;
  }, [isPending, state.error]);
  const sugestaoPct = savingsPercentFor(kind);
  const pcts = empresa ? PCTS_EMPRESA : PCTS;

  const cats: Cat[] = useMemo(
    () => [
      ...parentCategories.filter((c) => !categoriaOculta(categorias, c.key) || c.defaultValue > 0).map((c) => ({
        key: c.key,
        label: categoryLabel(categorias, c.key),
        color: colorForCategorySlice({ kind: "parent", value: c.key }, categorias),
        icon: categoryIcon(categorias, c.key),
        custom: false,
      })),
      ...customCategories.map((c) => ({
        key: c.id,
        label: c.name,
        color: colorForCategorySlice({ kind: "custom", value: c.id }, categorias),
        icon: CUSTOM_CATEGORY_ICON_MAP[c.icon] ?? Tag,
        iconName: c.icon,
        custom: true,
      })),
    ],
    [parentCategories, customCategories, categorias],
  );

  // Sem plano, a renda começa no que entrou no último mês fechado e o guardar na sugestão.
  const rendaSugerida = Math.round(hints.lastMonthIncome / 100) * 100;
  const rendaInicial = plan.plannedIncome || rendaSugerida;
  const [passo, setPasso] = useState<Passo>(1);
  const topoRef = useVoltarAoTopo<HTMLFormElement>(passo);
  const [income, setIncome] = useState(rendaInicial);
  const [investment, setInvestment] = useState(hasPlan ? plan.plannedInvestment : Math.round((rendaInicial * sugestaoPct) / 100));
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries([...parentCategories.map((c) => [c.key, c.defaultValue]), ...customCategories.map((c) => [c.id, c.defaultValue])]),
  );
  const [nota, setNota] = useState("");
  const [quando, setQuando] = useState<"sempre" | "so">("sempre");

  // "Montando o seu plano" dura um segundo e vira o "pronto".
  useEffect(() => {
    if (passo !== "monta") return;
    const id = setTimeout(() => setPasso("pronto"), 1000);
    return () => clearTimeout(id);
  }, [passo]);

  const alterado =
    income !== plan.plannedIncome ||
    investment !== plan.plannedInvestment ||
    parentCategories.some((c) => (values[c.key] ?? 0) !== c.defaultValue) ||
    customCategories.some((c) => (values[c.id] ?? 0) !== c.defaultValue);
  useEffect(() => {
    if (!alterado) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    const aoClicar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const destino = new URL(link.href, window.location.href);
      if (destino.origin !== window.location.origin || destino.pathname === window.location.pathname) return;
      if (!window.confirm("Você mudou o plano e ainda não salvou. Sair sem salvar?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", aoClicar, true);
    return () => {
      window.removeEventListener("beforeunload", avisar);
      document.removeEventListener("click", aoClicar, true);
    };
  }, [alterado]);
  const formId = useId();

  const resto = Math.max(0, income - investment);
  const distributed = cats.reduce((sum, c) => sum + (values[c.key] ?? 0), 0);
  const falta = resto - distributed;
  const pctAtual = income > 0 ? Math.round((investment / income) * 100) : 0;
  const pctEscolhido = pcts.find((p) => Math.round((income * p) / 100) === investment) ?? null;
  const temPadrao = hints.mesesComDado >= MESES_MINIMOS_DO_PADRAO;
  const nomeDe = (k: string) => cats.find((c) => c.key === k)?.label ?? k;
  const juntar = (a: string[]) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} e ${a[a.length - 1]}`);

  function aplicar(r: { val: Record<string, number>; abaixo: string[] }, comAviso: boolean) {
    setValues((prev) => ({ ...prev, ...r.val }));
    const ab = comAviso ? r.abaixo.map(nomeDe) : [];
    setNota(ab.length ? `Para caber, ${ab.length > 3 ? `${ab.slice(0, 2).join(", ")} e outras ${ab.length - 2} ficaram` : `${juntar(ab)} ${ab.length > 1 ? "ficaram" : "ficou"}`} abaixo do seu padrão` : "");
  }
  /** "Sugerir para mim": a régua da aula (ou da pequena empresa) sobre o resto; as que ela criou ficam como estão. */
  function sugerir() {
    const base: Record<string, number> = {};
    for (const c of cats) base[c.key] = c.custom ? (values[c.key] ?? 0) : income * courseShareOf(c.key as ParentCategory, kind);
    aplicar(fecharExato(resto, base, cats.filter((c) => c.custom).map((c) => c.key), FIXAS), false);
  }
  /** "Usar o meu padrão": a mediana dos últimos meses; as fixas ficam, as variáveis escalam até caber. */
  function usarPadrao() {
    const base: Record<string, number> = {};
    for (const c of cats) base[c.key] = Math.round((hints.padraoByCategory[c.key] ?? 0) / 10) * 10;
    aplicar(fecharExato(resto, base, FIXAS, FIXAS), true);
  }

  const atalhos = rendaSugerida > 0 ? [...new Set([Math.round((rendaSugerida * 0.9) / 100) * 100, rendaSugerida, Math.round((rendaSugerida * 1.1) / 100) * 100])] : [];
  const mesNome = mesDeAgora ? MESES[mesDeAgora - 1] : null;
  const numerado = typeof passo === "number";

  let conteudo: React.ReactNode = null;
  if (passo === 1) {
    conteudo = (
      <>
        <h3 className={pergunta}>{t.formOrcQuantoEntra}</h3>
        {hints.lastMonthIncome > 0 && <p className="text-[15px] text-ink-muted">{t.formOrcRendaSugestao(hints.lastMonthLabel, m(hints.lastMonthIncome))}</p>}
        <div className="mt-2 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
          <button type="button" aria-label={`Menos ${simbolo} 100`} onClick={() => setIncome((v) => Math.max(0, v - 100))} className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink">
            <Minus size={18} />
          </button>
          <label className="flex min-w-0 items-baseline justify-center gap-1.5">
            <span className="text-xl text-ink-muted">{simbolo}</span>
            <input
              inputMode="numeric"
              aria-label={t.formOrcRenda}
              placeholder="0"
              value={income ? income.toLocaleString("pt-BR") : ""}
              onChange={(ev) => setIncome(Number(ev.target.value.replace(/\D/g, "")) || 0)}
              className="w-full min-w-0 max-w-[7ch] border-b-2 border-accent bg-transparent pb-1 text-center text-[44px] font-light tabular-nums text-ink outline-none max-[359px]:text-[36px]"
            />
          </label>
          <button type="button" aria-label={`Mais ${simbolo} 100`} onClick={() => setIncome((v) => v + 100)} className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink">
            <Plus size={18} />
          </button>
        </div>
        {atalhos.length > 0 && (
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Atalhos de renda">
            {atalhos.map((v) => (
              <button key={v} type="button" aria-pressed={v === income} onClick={() => setIncome(v)} className="min-h-11 rounded-2xl bg-surface px-1 text-[15px] font-medium tabular-nums text-ink shadow-premium-sm aria-pressed:bg-ink aria-pressed:text-canvas aria-pressed:shadow-none">
                {m(v)}
              </button>
            ))}
          </div>
        )}
      </>
    );
  } else if (passo === 2) {
    const { liberdade, sonhos } = divisaoDoGuardar(income, investment);
    conteudo = (
      <>
        <h3 className={pergunta}>{t.formOrcQuantoGuardar}</h3>
        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Quanto guardar">
          {pcts.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={pctEscolhido === p}
              onClick={() => setInvestment(Math.round((income * p) / 100))}
              className="group flex h-[58px] flex-col items-center justify-center rounded-2xl bg-surface text-[17px] font-medium leading-tight text-ink shadow-premium-sm aria-pressed:bg-ink aria-pressed:text-canvas aria-pressed:shadow-none"
            >
              {p}%{p === sugestaoPct && <small className="text-[12px] font-medium text-accent-strong group-aria-pressed:text-canvas/80 max-[359px]:hidden">Sugestão</small>}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1 rounded-[20px] bg-atencao-fundo p-4">
          {/* Escrever o próprio valor (13/10/2026, pedido da Dani): além dos %, o número é um campo. */}
          <label htmlFor="guardar-por-mes" className="flex items-center justify-between gap-2 text-[13px] text-ink-muted">
            Por mês
            <span className="inline-flex items-center gap-1 text-accent-strong">
              <Pencil size={13} aria-hidden /> Escrever
            </span>
          </label>
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="text-xl font-light text-ink-muted">{simbolo}</span>
            <input
              id="guardar-por-mes"
              inputMode="numeric"
              aria-label="Quanto guardar por mês"
              placeholder="0"
              value={investment ? investment.toLocaleString("pt-BR") : ""}
              onChange={(ev) => setInvestment(Math.min(Number(ev.target.value.replace(/\D/g, "")) || 0, Math.max(income, 0) || Number.MAX_SAFE_INTEGER))}
              className="w-full min-w-0 border-b-2 border-accent/60 bg-transparent pb-0.5 text-[36px] font-light leading-tight tracking-[-0.03em] tabular-nums text-ink outline-none focus:border-accent"
            />
          </span>
          <div className="mt-2 flex flex-col gap-1.5 text-sm text-ink">
            {!empresa && pctEscolhido === 18 ? (
              <>
                <Linha cor="var(--color-success)" rotulo="Liberdade financeira · 10%" valor={m(liberdade)} />
                <Linha cor="var(--color-plano-3)" rotulo="Sonhos e metas · 8%" valor={m(sonhos)} />
              </>
            ) : (
              <Linha cor="var(--color-success)" rotulo={empresa ? "Fica no caixa" : "Reserva e metas"} valor={m(investment)} />
            )}
          </div>
        </div>
        {pctEscolhido === null && investment > 0 && <p className="text-[13px] text-ink-muted">Hoje o plano deixa {m(investment)} para guardar ({pctAtual}% da renda).</p>}
        <p className="text-[15px] text-ink-muted">
          <b className="font-medium text-ink">Sugestão: {sugestaoPct}%</b>
          {!empresa && " · 10% liberdade financeira + 8% sonhos"}
        </p>
      </>
    );
  } else if (passo === 3) {
    conteudo = (
      <>
        <h3 className={pergunta}>{t.formOrcComoDividir}</h3>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={sugerir} disabled={resto <= 0} data-guia="orc-sugerir" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-surface-2 px-2 text-sm font-medium text-ink disabled:opacity-40">
            <PieChart size={16} aria-hidden />
            {t.formOrcSugerir}
          </button>
          <button type="button" onClick={temPadrao ? usarPadrao : () => window.dispatchEvent(new Event(EVENTO_IMPORTAR))} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-surface-2 px-2 text-sm font-medium text-ink">
            {temPadrao ? <Repeat size={16} aria-hidden /> : <FileUp size={16} aria-hidden />}
            {temPadrao ? t.formOrcPadrao : "Importar extrato"}
          </button>
        </div>
        <div className="sticky -top-4 z-[2] -mx-4 flex flex-col gap-2 bg-canvas/95 px-4 py-2" data-resto={falta}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[15px] text-ink-muted">
            <span>
              <b className="text-xl font-medium tabular-nums text-ink">{m(resto)}</b> para dividir
            </span>
            <em className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-medium not-italic ${falta < 0 ? "bg-danger-soft text-danger" : falta === 0 ? "bg-success-soft text-success" : "bg-atencao-fundo text-atencao"}`}>
              {falta < 0 ? `Passou ${m(-falta)}` : falta === 0 ? (<><Check size={14} aria-hidden />Tudo dividido</>) : `Falta ${m(falta)}`}
            </em>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${falta < 0 ? "bg-danger" : "bg-accent"}`} style={{ width: `${Math.min(100, resto ? (distributed / resto) * 100 : 0)}%` }} />
          </div>
        </div>
        {nota && <p className="-mt-1 text-[13px] text-ink-muted">{nota}</p>}
        <div className="rounded-[20px] bg-surface px-3 shadow-premium-sm">
          {cats.map((c, i) => {
            const v = values[c.key] ?? 0;
            return (
              <div key={c.key} data-cat={c.key} className={`grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}>
                {c.custom ? (
                  // A que ela criou: lápis ou toque longo para editar e apagar (12/10/2026).
                  <LapisDaCategoria categoria={{ id: c.key, name: c.label, icon: c.iconName ?? "tag" }} outras={customCategories.map((o) => ({ id: o.id, name: o.name, icon: o.icon }))}>
                    <CategoryIcon icon={c.icon} color={c.color} size={36} emoji={emojiEscolhido(categorias, c.key) ?? emojiDaCategoria(tema, { kind: "custom" })} />
                  </LapisDaCategoria>
                ) : (
                  <CategoryIcon icon={c.icon} color={c.color} size={36} emoji={emojiEscolhido(categorias, c.key) ?? emojiDaCategoria(tema, { kind: "parent", value: c.key as ParentCategory })} />
                )}
                <div className="min-w-0">
                  <b className="block truncate text-[15px] font-normal leading-tight text-ink">{c.label}</b>
                  <small className="block text-xs text-ink-muted">{income > 0 ? Math.round((v / income) * 100) : 0}% da renda</small>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, resto ? (v / resto) * 250 : 0)}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label={`Menos ${STEP} em ${c.label}`} onClick={() => { setNota(""); setValues((p) => ({ ...p, [c.key]: Math.max(0, v - STEP) })); }} className="flex size-[30px] items-center justify-center rounded-full bg-surface-2 text-ink">
                    <Minus size={14} />
                  </button>
                  <input
                    inputMode="numeric"
                    aria-label={`Valor de ${c.label}`}
                    placeholder="0"
                    value={v ? Math.round(v).toLocaleString("pt-BR") : ""}
                    onChange={(ev) => { setNota(""); setValues((p) => ({ ...p, [c.key]: Number(ev.target.value.replace(/\D/g, "")) || 0 })); }}
                    className="h-[34px] w-16 rounded-[10px] border border-border-strong bg-canvas text-center text-[15px] font-medium tabular-nums text-ink outline-none focus:border-ink max-[359px]:w-14"
                  />
                  <button type="button" aria-label={`Mais ${STEP} em ${c.label}`} onClick={() => { setNota(""); setValues((p) => ({ ...p, [c.key]: v + STEP })); }} className="flex size-[30px] items-center justify-center rounded-full bg-surface-2 text-ink">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <NewCustomCategoryCard />
      </>
    );
  } else if (passo === "monta") {
    conteudo = (
      <div className="flex flex-col items-center gap-3 pb-5 pt-12" role="status">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
          <PieChart size={26} aria-hidden />
        </span>
        <b className="text-[17px] font-medium text-ink">Montando o seu plano</b>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full origin-left animate-[an-cresce-x_1s_ease-out] rounded-full bg-accent" />
        </div>
      </div>
    );
  } else {
    // Cor própria por categoria, sem 0% e com as lascas (< 2%) juntas em "Outras" (12/10/2026).
    const fatias = fatiasDoPlano(cats.map((c) => ({ k: c.key, n: c.label, v: values[c.key] ?? 0 })));
    const pc = porcentagensQueSomam100(fatias.map((f) => f.v));
    const cor = (k: number) => fatias[k].cor;
    conteudo = (
      <>
        <div className="flex flex-col items-center gap-1 pt-2 text-center">
          <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
            <Check size={24} aria-hidden />
          </span>
          <b className="text-[22px] font-semibold text-ink">{t.formOrcPronto}</b>
          <span className="text-sm text-ink-muted">{mesNome ? "Vale para todo mês" : `Vale para ${year}`}</span>
        </div>
        <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4" data-plano-pronto>
          <b className="text-[17px] font-medium text-ink">Seu plano</b>
          <p className="text-sm text-ink-muted">
            <span className="text-ink">{m(distributed)}</span> por mês
          </p>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
            {fatias.map((f, k) => (
              <i key={f.k} className="h-full" style={{ flex: f.v, background: cor(k) }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] text-ink">
            {fatias.map((f, k) => (
              <span key={f.k} className="flex min-w-0 items-center gap-1.5">
                <i className="size-2 shrink-0 rounded-full" style={{ background: cor(k) }} />
                <span className="truncate">{f.n}</span>
                <b className="ml-auto font-medium tabular-nums">{pc[k]}%</b>
              </span>
            ))}
          </div>
        </section>
        <div className="flex flex-col gap-2 rounded-[20px] bg-surface px-4 py-3 text-sm text-ink shadow-premium-sm">
          <Linha cor="var(--color-ink)" rotulo="Entra" valor={m(income)} />
          <Linha cor="var(--color-success)" rotulo={`Guardar · ${pctAtual}%`} valor={m(investment)} />
          {falta > 0 && <Linha cor="var(--color-plano-3)" rotulo="Fica livre" valor={m(falta)} />}
        </div>
        {mesNome && (
          <>
            <h4 className="mt-1 text-[15px] font-medium text-ink">Quando vale?</h4>
            <div className="grid grid-cols-2 rounded-full bg-surface-2 p-0.5" role="group" aria-label="Quando o plano vale">
              {(["sempre", "so"] as const).map((q) => (
                <button key={q} type="button" aria-pressed={quando === q} onClick={() => setQuando(q)} className="min-h-10 whitespace-nowrap rounded-full px-1.5 text-sm text-ink-muted max-[359px]:text-[13px] aria-pressed:bg-surface aria-pressed:font-medium aria-pressed:text-ink aria-pressed:shadow-premium-sm">
                  {q === "sempre" ? `A partir de ${mesNome}` : `Só ${mesNome}`}
                </button>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  const rodape =
    passo === 1 ? (
      <button type="button" className={botao} disabled={income <= 0} onClick={() => setPasso(2)} data-guia="orc-ir-divisao" data-guia-txt="Confira a renda e toque em Continuar">
        Continuar
      </button>
    ) : passo === 2 ? (
      <button type="button" className={botao} onClick={() => setPasso(3)} data-guia="orc-ir-divisao" data-guia-txt="Escolha quanto guardar e toque em Continuar">
        Continuar
      </button>
    ) : passo === 3 ? (
      <button type="button" className={botao} disabled={falta < 0 || distributed <= 0} onClick={() => setPasso("monta")}>
        {falta < 0 ? "Tire o que passou" : t.formOrcVerPlano}
      </button>
    ) : passo === "pronto" ? (
      <div className="flex flex-col items-center gap-1">
        <button type="submit" className={botao} disabled={isPending}>
          {isPending ? t.formSalvando : t.formOrcUsar}
        </button>
        <button type="button" onClick={() => setPasso(3)} className="min-h-11 px-4 text-[15px] font-medium text-ink-muted">
          Ajustar mais
        </button>
      </div>
    ) : null;

  return (
    <form ref={topoRef} id={formId} action={formAction} className="flex flex-col gap-4" data-montar-plano={passo}>
      <div hidden>
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="profileId" value={profileId} />
        <input type="hidden" name="plannedIncome" value={income} />
        <input type="hidden" name="plannedInvestment" value={investment} />
        <input type="hidden" name="quando" value={mesNome ? quando : "sempre"} />
        <input type="hidden" name="plannedIncomeOriginal" value={plan.plannedIncome} />
        <input type="hidden" name="plannedInvestmentOriginal" value={plan.plannedInvestment} />
        {parentCategories.map((c) => (
          <span key={c.key}>
            <input type="hidden" name={`plannedAmount_${c.key}`} value={values[c.key] ?? 0} />
            <input type="hidden" name={`plannedOriginal_${c.key}`} value={c.defaultValue} />
          </span>
        ))}
        {customCategories.map((c) => (
          <span key={c.id}>
            <input type="hidden" name="customCategoryId" value={c.id} />
            <input type="hidden" name={`plannedAmount_custom_${c.id}`} value={values[c.id] ?? 0} />
            <input type="hidden" name={`plannedOriginal_custom_${c.id}`} value={c.defaultValue} />
          </span>
        ))}
      </div>

      {(numerado || passo === "pronto") && (
        <div className="flex min-h-11 items-center gap-3">
          {passo === 1 && aoVoltarDoInicio ? (
            <button type="button" onClick={aoVoltarDoInicio} className="-ml-1 flex min-h-11 items-center gap-1 pr-2 text-[15px] font-medium text-ink">
              <ChevronLeft size={18} aria-hidden /> Voltar
            </button>
          ) : passo === 2 || passo === 3 ? (
            <button type="button" onClick={() => setPasso(passo === 2 ? 1 : 2)} className="-ml-1 flex min-h-11 items-center gap-1 pr-2 text-[15px] font-medium text-ink">
              <ChevronLeft size={18} aria-hidden /> Voltar
            </button>
          ) : passo === "pronto" ? (
            <button type="button" onClick={() => setPasso(3)} className="-ml-1 flex min-h-11 items-center gap-1 pr-2 text-[15px] font-medium text-ink">
              <ChevronLeft size={18} aria-hidden /> Voltar
            </button>
          ) : null}
          {numerado && (
            <div className="flex flex-1 gap-1.5" aria-label={t.formOrcPasso(passo, 3)}>
              {[1, 2, 3].map((k) => (
                <i key={k} className={`h-[3px] flex-1 rounded-full ${k <= passo ? "bg-ink" : "bg-border-strong"}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div key={String(passo)} className="passo-entra flex flex-col gap-3.5">
        {conteudo}
      </div>

      {/* Rodapé sem caixa (12/10/2026): o fundo é o da folha, e o fim respeita a área segura. */}
      {rodape && <div className="pb-[var(--safe-bottom)] pt-1">{rodape}</div>}

      {/* Mudança não salva e a janela fechada: a barra continua à vista para salvar. */}
      {alterado &&
        passo !== "pronto" &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-x-3 bottom-[calc(7rem_+_var(--safe-bottom))] z-40 flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-surface px-4 py-3 shadow-premium md:inset-x-auto md:bottom-6 md:right-6 md:w-96">
            <span className="text-sm font-medium text-ink">Mudanças ainda não salvas</span>
            <Button type="submit" form={formId} size="sm" disabled={isPending}>
              {isPending ? t.formSalvando : "Salvar"}
            </Button>
          </div>,
          document.body,
        )}
    </form>
  );
}

function Linha({ cor, rotulo, valor }: { cor: string; rotulo: string; valor: string }) {
  return (
    <span className="flex items-center gap-2">
      <i className="size-2 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(20,20,20,.28)]" style={{ background: cor }} />
      <span className="min-w-0">{rotulo}</span>
      <b className="ml-auto whitespace-nowrap font-medium tabular-nums">{valor}</b>
    </span>
  );
}
