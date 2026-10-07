"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  ChevronLeft,
  Compass,
  Footprints,
  Hand,
  LifeBuoy,
  ShoppingCart,
  Sprout,
  Sunrise,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { RiskProfileKey } from "@/lib/portfolio/risk-profile";
import {
  estrategiaPelosSonhos,
  faixaDoSonho,
  FAIXAS,
  perfilPeloComportamento,
  PERFIS_PRONTOS,
  type Faixa,
  type Sonho,
} from "@/lib/portfolio/estrategia-pelos-sonhos";
import type { StrategyAssetClass } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { useVoltarAoTopo } from "@/components/ui/useVoltarAoTopo";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import type { Titulos } from "@/lib/profiles/voice";
import { DonutAllocationChart } from "@/components/charts/DonutAllocationChart";
import { STRATEGY_ASSET_CLASSES, STRATEGY_ASSET_CLASS_COLOR, STRATEGY_ASSET_CLASS_LABEL } from "@/lib/portfolio/strategy";
import { vibrar } from "@/lib/celebrar";
import { savePortfolioStrategyAction, type PortfolioStrategyState } from "./actions";
import { formatPercentNumber } from "@/lib/format";

const initialState: PortfolioStrategyState = {};

type Preset = { key: RiskProfileKey; label: string; description: string; values: Record<StrategyAssetClass, number> };

const PRESET_ORDEM: RiskProfileKey[] = ["conservador", "moderado", "arrojado"];

function montarPresets(t: Titulos): Record<RiskProfileKey, Preset> {
  const entradas = PRESET_ORDEM.map((key) => [key, { key, label: t.formEstPerfis[key].nome, description: t.formEstPerfis[key].descricao, values: PERFIS_PRONTOS[key] }]);
  return Object.fromEntries(entradas) as Record<RiskProfileKey, Preset>;
}

type Pergunta = { key: "queda" | "experiencia"; question: string; options: { label: string; points: number }[] };

/**
 * Só perguntas sobre ela (06/10/2026): o prazo agora vem dos sonhos, e a reserva já é um sonho
 * de curto prazo. Os pontos (0, 1, 2) são fixos; as palavras vêm da voz do tema.
 */
function montarQuiz(t: Titulos): Pergunta[] {
  const opcoes = (labels: [string, string, string]) => labels.map((label, points) => ({ label, points }));
  return [
    { key: "queda", question: t.formEstQuedaPergunta, options: opcoes(t.formEstQuedaOpcoes) },
    { key: "experiencia", question: t.formEstExperienciaPergunta, options: opcoes(t.formEstExperienciaOpcoes) },
  ];
}

/** Um ícone por resposta: a pessoa reconhece a opção antes de terminar de ler. */
const ICONES: Record<Pergunta["key"], [LucideIcon, LucideIcon, LucideIcon]> = {
  queda: [TriangleAlert, Hand, ShoppingCart],
  experiencia: [Sprout, Footprints, BadgeCheck],
};

const ICONE_DO_SONHO: Record<Sonho["tipo"], LucideIcon> = { reserva: LifeBuoy, meta: Target, liberdade: Sunrise };

type Modo = "inicio" | "sonhos" | "perguntas" | "perfil" | "resultado" | "resumo" | "ajustar";

/**
 * A estratégia a partir dos sonhos (06/10/2026, segunda versão). A Dani: "posso precisar do dinheiro
 * em dois anos, em dois a cinco, em mais de cinco; vou ter uma carteira diversificada. Começa pelos
 * sonhos, descobre o perfil, mostra uma estratégia assim, e dá para personalizar." O caminho:
 *
 * 1. Seus sonhos: cada um com quanto falta, separados por prazo (até 2 anos, 2 a 5, mais de 5).
 * 2. Descobrir o perfil: só sobre ela (queda de 15% e experiência com renda variável).
 * 3. Seu perfil é…: a revelação, com o porquê numa linha.
 * 4. Uma estratégia para os seus sonhos: a rosca e o que cada prazo vira; "Usar" já salva.
 * 5. Personalizar: as barrinhas de sempre, agora o modo avançado.
 *
 * Com estratégia salva, a tela abre no resumo (rosca, Personalizar, Refazer). A conta mora em
 * lib/portfolio/estrategia-pelos-sonhos.ts.
 */
export function StrategyForm({
  defaults,
  sonhos,
}: {
  defaults: Record<StrategyAssetClass, number>;
  /** Os sonhos com valor faltando: reserva, metas e a liberdade financeira do plano. */
  sonhos: Sonho[];
}) {
  const t = useProfileTheme().voz.titulos;
  const presets = useMemo(() => montarPresets(t), [t]);
  const quiz = useMemo(() => montarQuiz(t), [t]);
  const [state, formAction, isPending] = useActionState(savePortfolioStrategyAction, initialState);
  useSuccessToast(isPending, state.error, t.formEstSalva);
  const [values, setValues] = useState<Record<StrategyAssetClass, number>>(defaults);
  const hasStrategy = STRATEGY_ASSET_CLASSES.some((k) => (defaults[k] || 0) > 0);
  const [modo, setModo] = useState<Modo>(hasStrategy ? "resumo" : "inicio");
  const [passo, setPasso] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<Pergunta["key"], number>>>({});
  const money = useMoney();
  const topoRef = useVoltarAoTopo<HTMLDivElement>(`${modo}-${passo}`);

  // Salvou (pelo "Usar essa estratégia" ou pelas barrinhas): mostra o resumo do que ficou.
  // No render, e não num efeito, como o resto do app faz com estado que segue outro estado.
  const [estavaSalvando, setEstavaSalvando] = useState(false);
  if (isPending !== estavaSalvando) {
    setEstavaSalvando(isPending);
    if (!isPending && !state.error) setModo("resumo");
  }

  const answered = quiz.every((q) => answers[q.key] !== undefined);
  const resultado = answered
    ? perfilPeloComportamento({ queda: answers.queda as 0 | 1 | 2, experiencia: answers.experiencia as 0 | 1 | 2 })
    : null;
  const perfil = resultado ? presets[resultado.profile] : null;
  const pelosSonhos = resultado ? estrategiaPelosSonhos(resultado.profile, sonhos) : null;

  const sum = STRATEGY_ASSET_CLASSES.reduce((acc, key) => acc + (values[key] || 0), 0);
  const sumOk = Math.abs(sum - 100) < 0.01;

  // Diferente do que está salvo? `defaults` vem do banco e volta atualizado depois de salvar
  // (a action revalida a página), então a comparação se resolve sozinha.
  const alterado = STRATEGY_ASSET_CLASSES.some((k) => Math.round(values[k] || 0) !== Math.round(defaults[k] || 0));
  useEffect(() => {
    if (!alterado) return;
    // Fechar a aba ou recarregar com mudança não salva: o navegador pergunta antes.
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [alterado]);

  /** "Usar essa estratégia" já salva: o botão de salvar das barrinhas ficava longe, e ela saía achando que tinha gravado. */
  function usarPerfil(novos: Record<StrategyAssetClass, number>) {
    setValues(novos);
    const fd = new FormData();
    for (const k of STRATEGY_ASSET_CLASSES) fd.set(k, String(novos[k] ?? 0));
    startTransition(() => formAction(fd));
  }

  function comecar() {
    setAnswers({});
    setPasso(0);
    setModo("sonhos");
  }

  function responder(pergunta: Pergunta, pontos: number) {
    setAnswers((prev) => ({ ...prev, [pergunta.key]: pontos }));
    vibrar("leve");
    // Um instante para ver a escolha marcada antes de passar.
    const ultimo = passo === quiz.length - 1;
    window.setTimeout(() => {
      if (ultimo) setModo("perfil");
      else setPasso((p) => p + 1);
    }, 280);
  }

  const fatias = (v: Record<StrategyAssetClass, number>) =>
    STRATEGY_ASSET_CLASSES.filter((k) => (v[k] || 0) > 0).map((key) => ({
      id: key,
      name: STRATEGY_ASSET_CLASS_LABEL[key],
      value: (v[key] || 0) / 100,
      color: STRATEGY_ASSET_CLASS_COLOR[key],
    }));

  const pergunta = quiz[passo];

  return (
    // No computador, o jogo e o resumo ficam num cartão estreito e centrado, como uma tela de app:
    // esticados em 900px, as respostas viravam faixas compridas com a rosca perdida no meio. As
    // barrinhas usam a largura toda (campos de um lado, rosca do outro).
    <div ref={topoRef} className={modo === "ajustar" ? "" : "mx-auto w-full lg:max-w-xl"}>
    <Card as="form" action={formAction} className="flex flex-col gap-6 p-5 sm:p-6">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      {/* Os valores das barrinhas vão no envio do "Salvar" (as barrinhas não têm name). */}
      {STRATEGY_ASSET_CLASSES.map((k) => (
        <input key={k} type="hidden" name={k} value={values[k]} />
      ))}

      {modo === "inicio" && (
        <div className="passo-entra flex flex-col items-start gap-4 py-2">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent-gradient text-on-accent shadow-premium-sm">
            <Compass size={26} strokeWidth={1.9} aria-hidden />
          </span>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">{t.formEstJogoTitulo}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t.formEstJogoSub}</p>
          </div>
          <Button type="button" onClick={comecar} className="w-full sm:w-auto sm:px-8">
            {t.formEstComecar}
          </Button>
          <button type="button" onClick={() => setModo("ajustar")} className="text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline">
            {t.formEstNaMao}
          </button>
        </div>
      )}

      {modo === "perguntas" && pergunta && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => (passo > 0 ? setPasso((p) => p - 1) : setModo("sonhos"))}
              className="-ml-1 flex min-h-9 items-center gap-0.5 text-sm text-ink-muted hover:text-ink"
            >
              <ChevronLeft size={16} aria-hidden />
              {t.formEstVoltar}
            </button>
            <span className="text-caption font-medium tabular-nums text-ink-muted">{t.formEstPasso(passo + 1, quiz.length)}</span>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {quiz.map((q, i) => (
              <span key={q.key} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= passo ? "bg-accent" : "bg-surface-2"}`} />
            ))}
          </div>

          <div key={pergunta.key} className="passo-entra flex flex-col gap-3">
            <h2 className="text-xl font-bold leading-snug tracking-tight text-ink">{pergunta.question}</h2>
            {pergunta.options.map((o, i) => {
              const Icone = ICONES[pergunta.key][i];
              const marcada = answers[pergunta.key] === o.points;
              return (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => responder(pergunta, o.points)}
                  aria-pressed={marcada}
                  className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 active:scale-[0.98] ${
                    marcada ? "border-accent bg-accent-soft" : "border-border bg-surface-2 hover:border-border-strong"
                  }`}
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                      marcada ? "bg-accent-gradient text-on-accent" : "bg-surface text-accent-strong"
                    }`}
                  >
                    <Icone size={19} strokeWidth={1.9} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-ink">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {modo === "sonhos" && (
        <div className="passo-entra flex flex-col gap-5">
          <button
            type="button"
            onClick={() => setModo(hasStrategy ? "resumo" : "inicio")}
            className="-ml-1 flex min-h-9 w-fit items-center gap-0.5 text-sm text-ink-muted hover:text-ink"
          >
            <ChevronLeft size={16} aria-hidden />
            {t.formEstVoltar}
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink">{t.formEstSonhosTitulo}</h2>
            {sonhos.length > 0 && <p className="mt-0.5 text-sm text-ink-muted">{t.formEstSonhosSub}</p>}
          </div>
          {sonhos.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-ink-muted">{t.formEstSemSonhos}</p>
              <Link href="/planejamento/metas" className="inline-flex min-h-10 items-center rounded-full bg-pill px-4 text-sm font-semibold text-on-pill">
                {t.formEstCadastrarSonho}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {FAIXAS.map((faixa) => {
                const daFaixa = sonhos.filter((s) => faixaDoSonho(s) === faixa);
                if (daFaixa.length === 0) return null;
                return (
                  <div key={faixa} className="flex flex-col gap-1.5">
                    <p className="text-caption font-semibold uppercase tracking-[0.11em] text-accent-strong">{t.formEstFaixa[faixa]}</p>
                    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface-2">
                      {daFaixa.map((s) => {
                        const Icone = ICONE_DO_SONHO[s.tipo];
                        return (
                          <li key={s.id} className="flex items-center gap-3 px-3.5 py-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-accent-strong">
                              <Icone size={17} strokeWidth={1.9} aria-hidden />
                            </span>
                            {/* O nome inteiro em cima e quanto falta embaixo: lado a lado, o nome da viagem cortava. */}
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium leading-snug text-ink">{s.nome}</span>
                              <span className="block text-caption tabular-nums text-ink-muted">{t.formEstFalta(money(s.falta, { round: true }))}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          <Button type="button" onClick={() => setModo("perguntas")} className="w-full sm:w-auto sm:px-8">
            {sonhos.length === 0 ? t.formEstSeguirSemSonhos : t.formEstDescobrirPerfil}
          </Button>
        </div>
      )}

      {modo === "perfil" && perfil && resultado && (
        <div className="passo-entra flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent-gradient text-on-accent shadow-premium-sm">
            <Compass size={26} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="text-caption font-semibold uppercase tracking-[0.11em] text-accent-strong">{t.formEstSeuPerfil}</p>
          <h2 className="text-4xl font-extrabold tracking-tight text-ink">{perfil.label}</h2>
          <p className="text-sm text-ink-muted">{perfil.description}</p>
          <p className="text-caption text-ink-faint">{resultado.reason}</p>
          <Button type="button" onClick={() => setModo("resultado")} className="mt-2 w-full sm:w-auto sm:px-8">
            {t.formEstVerEstrategia}
          </Button>
        </div>
      )}

      {modo === "resultado" && perfil && pelosSonhos && (
        <div className="passo-entra flex flex-col gap-4">
          <h2 className="text-center text-xl font-bold tracking-tight text-ink">{t.formEstPelosSonhosTitulo}</h2>
          <DonutAllocationChart title="" data={fatias(pelosSonhos.valores)} legend animar />
          {pelosSonhos.faixas.length === 0 ? (
            <p className="text-center text-caption text-ink-muted">{t.formEstSoPerfil}</p>
          ) : (
            // O que cada prazo vira: é o "porquê" da rosca, numa linha por faixa.
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface-2">
              {pelosSonhos.faixas.map((f) => (
                <li key={f.faixa} className="flex flex-col gap-0.5 px-3.5 py-3">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{t.formEstFaixa[f.faixa as Faixa]}</span>
                    <span className="text-caption tabular-nums text-ink-muted">{money(f.total, { round: true })}</span>
                  </span>
                  <span className="text-caption text-ink-muted">
                    {f.faixa === "curto" ? t.formEstMisturaCurto : f.faixa === "medio" ? t.formEstMisturaMedio : t.formEstMisturaLongo(perfil.label)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="button" disabled={isPending} onClick={() => usarPerfil(pelosSonhos.valores)} className="w-full sm:w-auto sm:px-6">
              {isPending ? t.formSalvando : t.formEstUsarPerfil}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setValues(pelosSonhos.valores);
                setModo("ajustar");
              }}
              className="w-full sm:w-auto"
            >
              {t.formEstPersonalizar}
            </Button>
          </div>
          <button type="button" onClick={comecar} className="mx-auto text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline">
            {t.formEstRefazer}
          </button>
        </div>
      )}

      {modo === "resumo" && (
        <div className="passo-entra flex flex-col gap-4">
          <DonutAllocationChart title="" data={fatias(values)} legend />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="button" variant="secondary" onClick={() => setModo("ajustar")} className="w-full sm:w-auto">
              {t.formEstPersonalizar}
            </Button>
            <Button type="button" variant="ghost" onClick={comecar} className="w-full sm:w-auto">
              {t.formEstRefazer}
            </Button>
          </div>
        </div>
      )}

      {modo === "ajustar" && (
        <div className="passo-entra flex flex-col gap-6">
          <button
            type="button"
            onClick={() => setModo(hasStrategy ? "resumo" : "inicio")}
            className="-ml-1 flex min-h-9 w-fit items-center gap-0.5 text-sm text-ink-muted hover:text-ink"
          >
            <ChevronLeft size={16} aria-hidden />
            {t.formEstVoltar}
          </button>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">{t.formEstPronto}</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_ORDEM.map((key) => {
                const preset = presets[key];
                return (
                  <button
                    key={key}
                    type="button"
                    title={preset.description}
                    onClick={() => setValues(preset.values)}
                    className="rounded-full border border-border-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:bg-surface-hover"
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campos à esquerda, rosca ao vivo à direita (empilha no celular). */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-4">
              {STRATEGY_ASSET_CLASSES.map((assetClass) => {
                const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
                const set = (n: number) => setValues((prev) => ({ ...prev, [assetClass]: clamp(n) }));
                return (
                  <div key={assetClass} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium text-ink">
                        <span className="size-2.5 rounded-full" style={{ background: STRATEGY_ASSET_CLASS_COLOR[assetClass] }} aria-hidden />
                        {STRATEGY_ASSET_CLASS_LABEL[assetClass]}
                      </span>
                      {/* Dá para arrastar a barrinha OU digitar aqui. */}
                      <div className="flex items-center rounded-lg border border-border-strong bg-surface focus-within:border-accent">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={values[assetClass]}
                          onChange={(e) => set(Number(e.target.value))}
                          aria-label={`${STRATEGY_ASSET_CLASS_LABEL[assetClass]} em porcentagem`}
                          className="w-11 bg-transparent py-1 pl-2 text-right text-sm font-semibold tabular-nums text-ink focus:outline-none"
                        />
                        <span className="pr-2 text-sm text-ink-muted">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={values[assetClass]}
                      onChange={(e) => set(Number(e.target.value))}
                      aria-label={STRATEGY_ASSET_CLASS_LABEL[assetClass]}
                      style={{ accentColor: "var(--color-accent)" }}
                      className="w-full cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-2/50 p-4">
              <DonutAllocationChart title={t.formEstComoFicaria} data={fatias(values)} />
            </div>
          </div>

          {/* Validação dos 100% com barra e cor. */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className={`text-sm font-semibold tabular-nums ${sumOk ? "text-success" : "text-danger"}`}>
                  {t.formEstSoma(formatPercentNumber(sum, 1))} {sumOk ? t.formEstFecha : t.formEstNaoFecha}
                </span>
                {/* Perfil pronto e barrinhas só mudam a tela: sem esse aviso, "fecha em 100%" em verde parecia "salvo". */}
                {alterado && !isPending && <span className="text-caption text-ink-muted">{t.formEstNaoSalva}</span>}
              </span>
              <Button type="submit" disabled={isPending || !sumOk}>
                {isPending ? t.formSalvando : t.formEstSalvar}
              </Button>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full transition-all ${sumOk ? "bg-success" : sum > 100 ? "bg-danger" : "bg-accent"}`}
                style={{ width: `${Math.min(100, sum)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
    </div>
  );
}
