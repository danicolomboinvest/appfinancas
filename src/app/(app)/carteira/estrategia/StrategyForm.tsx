"use client";

import { useActionState, useState } from "react";
import { riskProfileFromAnswers, type RiskProfileKey, type GoalHorizon } from "@/lib/portfolio/risk-profile";
import type { StrategyAssetClass } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { DonutAllocationChart } from "@/components/charts/DonutAllocationChart";
import { STRATEGY_ASSET_CLASSES, STRATEGY_ASSET_CLASS_LABEL } from "@/lib/portfolio/strategy";
import { savePortfolioStrategyAction, type PortfolioStrategyState } from "./actions";
import { formatPercentNumber } from "@/lib/format";

const initialState: PortfolioStrategyState = {};

type Preset = { label: string; description: string; values: Record<StrategyAssetClass, number> };

const PRESETS: Preset[] = [
  {
    label: "Conservador",
    description: "Prioriza previsibilidade, a maior parte em renda fixa.",
    values: {
      RENDA_FIXA_POS_FIXADA: 50,
      RENDA_FIXA_IPCA: 30,
      PREFIXADO: 10,
      ACOES_BRASIL: 5,
      FIIS: 5,
      EXTERIOR: 0,
      OUTROS: 0,
    },
  },
  {
    label: "Moderado",
    description: "Equilibra renda fixa e renda variável.",
    values: {
      RENDA_FIXA_POS_FIXADA: 25,
      RENDA_FIXA_IPCA: 20,
      PREFIXADO: 10,
      ACOES_BRASIL: 20,
      FIIS: 15,
      EXTERIOR: 10,
      OUTROS: 0,
    },
  },
  {
    label: "Arrojado",
    description: "Prioriza crescimento de longo prazo, a maior parte em renda variável.",
    values: {
      RENDA_FIXA_POS_FIXADA: 10,
      RENDA_FIXA_IPCA: 5,
      PREFIXADO: 0,
      ACOES_BRASIL: 40,
      FIIS: 20,
      EXTERIOR: 20,
      OUTROS: 5,
    },
  },
];

/**
 * Três perguntas de gente pra chegar num perfil. Quem não sabe o que é "renda fixa
 * pós-fixada" sabe quando vai precisar do dinheiro e quanto aguenta ver cair.
 */
const PERGUNTA_PRAZO = {
  key: "prazo",
  question: "Quando você vai precisar desse dinheiro?",
  options: [
    { label: "Em menos de 2 anos", points: 0 },
    { label: "Entre 2 e 5 anos", points: 1 },
    { label: "Daqui a mais de 5 anos", points: 2 },
  ],
};

const QUIZ: { key: string; question: string; options: { label: string; points: number }[] }[] = [
  PERGUNTA_PRAZO,
  {
    key: "queda",
    question: "Se a carteira caísse 15% num mês, você…",
    options: [
      { label: "Venderia tudo, não dormiria", points: 0 },
      { label: "Ficaria tensa, mas seguraria", points: 1 },
      { label: "Aproveitaria pra comprar mais", points: 2 },
    ],
  },
  {
    key: "reserva",
    question: "Sua reserva de emergência já está completa?",
    options: [
      { label: "Ainda não", points: 0 },
      { label: "Quase lá", points: 1 },
      { label: "Sim", points: 2 },
    ],
  },
];

const PRAZO_LABEL: Record<0 | 1 | 2, string> = {
  0: "menos de 2 anos",
  1: "2 a 5 anos",
  2: "mais de 5 anos",
};

const PRESET_POR_PERFIL: Record<RiskProfileKey, Preset> = {
  conservador: PRESETS[0],
  moderado: PRESETS[1],
  arrojado: PRESETS[2],
};

export function StrategyForm({
  defaults,
  goalHorizon,
}: {
  defaults: Record<StrategyAssetClass, number>;
  /** Prazo calculado das metas da pessoa; null quando ela não tem meta com data. */
  goalHorizon: GoalHorizon | null;
}) {
  const [state, formAction, isPending] = useActionState(savePortfolioStrategyAction, initialState);
  useSuccessToast(isPending, state.error, "Estratégia salva com sucesso.");
  const [values, setValues] = useState<Record<StrategyAssetClass, number>>(defaults);
  const hasStrategy = STRATEGY_ASSET_CLASSES.some((k) => (defaults[k] || 0) > 0);
  const [quizOpen, setQuizOpen] = useState(!hasStrategy);
  // O prazo vem das METAS quando elas existem: a pessoa já disse quando precisa do dinheiro
  // ao cadastrar a viagem, o apê, a aposentadoria. Perguntar de novo é pedir a mesma coisa
  // duas vezes — e aceitar uma resposta que pode contradizer as metas dela.
  const [answers, setAnswers] = useState<Record<string, number>>(() => (goalHorizon ? { prazo: goalHorizon.prazo } : ({} as Record<string, number>)));
  const [editarPrazo, setEditarPrazo] = useState(false);
  const perguntas = goalHorizon && !editarPrazo ? QUIZ.filter((q) => q.key !== "prazo") : QUIZ;
  const answered = QUIZ.every((q) => answers[q.key] !== undefined);
  const resultado = answered
    ? riskProfileFromAnswers({
        prazo: answers.prazo as 0 | 1 | 2,
        queda: answers.queda as 0 | 1 | 2,
        reserva: answers.reserva as 0 | 1 | 2,
      })
    : null;
  const suggested = resultado ? PRESET_POR_PERFIL[resultado.profile] : null;

  const sum = STRATEGY_ASSET_CLASSES.reduce((acc, key) => acc + (values[key] || 0), 0);
  const sumOk = Math.abs(sum - 100) < 0.01;

  // Gráfico de pizza ao vivo: converte % (0-100) em fração (0-1) que o donut espera.
  const liveData = STRATEGY_ASSET_CLASSES.map((key) => ({
    id: key,
    name: STRATEGY_ASSET_CLASS_LABEL[key],
    value: (values[key] || 0) / 100,
  }));

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-6 p-5">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-soft/30 p-4">
        <button type="button" onClick={() => setQuizOpen((v) => !v)} className="flex items-center justify-between text-left">
          <span className="text-sm font-semibold text-ink">Não sabe por onde começar? Três perguntas.</span>
          <span className="text-xs text-ink-muted">{quizOpen ? "fechar" : "abrir"}</span>
        </button>
        {quizOpen && (
          <div className="flex flex-col gap-3">
            {goalHorizon && !editarPrazo && (
              <div className="flex flex-col gap-1 rounded-lg bg-surface px-3 py-2.5">
                <p className="text-sm text-ink">
                  Pelas suas metas, você vai precisar do dinheiro em <b>{PRAZO_LABEL[goalHorizon.prazo]}</b>.
                </p>
                <p className="text-caption text-ink-faint">{goalHorizon.summary}</p>
                <button type="button" onClick={() => setEditarPrazo(true)} className="w-fit text-caption font-medium text-accent-strong hover:underline">
                  Não é isso, quero responder
                </button>
              </div>
            )}
            {perguntas.map((q) => (
              <div key={q.key} className="flex flex-col gap-1.5">
                <p className="text-sm text-ink">{q.question}</p>
                <div className="flex flex-wrap gap-1.5">
                  {q.options.map((o) => {
                    const on = answers[q.key] === o.points;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.key]: o.points }))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          on ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {suggested && (
              <div className="flex flex-col gap-2 rounded-lg bg-surface px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink">
                  Pelas respostas, seu perfil é <b>{suggested.label}</b>. {suggested.description}
                  {resultado && <span className="mt-1 block text-caption text-ink-muted">{resultado.reason}</span>}
                </p>
                <Button type="button" size="sm" onClick={() => { setValues(suggested.values); setQuizOpen(false); }}>
                  Usar esse perfil
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Ou comece de um perfil pronto (você pode ajustar depois)</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              title={preset.description}
              onClick={() => setValues(preset.values)}
              className="rounded-full border border-border-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:bg-surface-hover"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Campos à esquerda, pizza ao vivo à direita (empilha no mobile). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {STRATEGY_ASSET_CLASSES.map((assetClass) => {
            const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
            const set = (n: number) => setValues((prev) => ({ ...prev, [assetClass]: clamp(n) }));
            return (
              <div key={assetClass} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{STRATEGY_ASSET_CLASS_LABEL[assetClass]}</span>
                  {/* Caixinha do %, dá pra arrastar o slider OU digitar aqui. */}
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
                {/* Slider: arrasta pra definir o alvo da classe. */}
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
          {/* Envia os valores do estado (o slider/caixa não têm name pra não duplicar). */}
          {STRATEGY_ASSET_CLASSES.map((k) => (
            <input key={k} type="hidden" name={k} value={values[k]} />
          ))}
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-2/50 p-4">
          <DonutAllocationChart title="Como sua carteira ficaria" data={liveData} />
        </div>
      </div>

      {/* Validação dos 100% com barra e cor. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold tabular-nums ${sumOk ? "text-success" : "text-danger"}`}>
            Soma: {formatPercentNumber(sum, 1)} {sumOk ? "✓ fecha em 100%" : "— precisa somar 100%"}
          </span>
          <Button type="submit" disabled={isPending || !sumOk}>
            {isPending ? "Salvando..." : "Salvar estratégia"}
          </Button>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full transition-all ${sumOk ? "bg-success" : sum > 100 ? "bg-danger" : "bg-accent"}`}
            style={{ width: `${Math.min(100, sum)}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
