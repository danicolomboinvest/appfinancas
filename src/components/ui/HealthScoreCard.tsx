"use client";

import { useEffect, useState } from "react";
import type { FinancialHealthScore, HealthStatus } from "@/lib/health-score";
import { Card } from "./Card";
import { CountUp } from "./CountUp";

const STATUS_TEXT_CLASS: Record<HealthStatus, string> = {
  boa: "text-success",
  atencao: "text-accent-strong",
  critica: "text-danger",
  "sem-dados": "text-ink-muted",
};

/** Cores do arco por status, gradiente sempre termina no dourado da marca. */
const STATUS_GRADIENT: Record<HealthStatus, [string, string]> = {
  boa: ["#7e9473", "#c9a15c"],
  atencao: ["#c9a15c", "#b15b3e"],
  critica: ["#b15b3e", "#8a3d28"],
  "sem-dados": ["#9a9486", "#9a9486"],
};

/**
 * Arco de score (estilo "Opal Score"): semicírculo com gradiente preenchido até a nota,
 * número gigante no centro e as dimensões como pílulas com anel de progresso, substitui
 * as barras de progresso lineares por algo mais moderno e legível de relance.
 */
function ScoreArc({ score, status }: { score: number | null; status: HealthStatus }) {
  const radius = 84;
  const circumference = Math.PI * radius; // semicírculo
  const fraction = (score ?? 0) / 100;
  const [from, to] = STATUS_GRADIENT[status];

  // Anima o arco de 0 até a nota na entrada da tela (~1,2-1,5s), o "elemento hero" do
  // documento de referência de design nasce vazio e se preenche, em vez de já aparecer pronto.
  const [offset, setOffset] = useState(circumference);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOffset(circumference * (1 - fraction)));
    return () => cancelAnimationFrame(raf);
  }, [circumference, fraction]);

  return (
    <div className="relative mx-auto h-32 w-56">
      <svg viewBox="0 0 200 110" className="h-full w-full">
        <defs>
          <linearGradient id="score-arc" x1="0%" y1="100%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        {/* Trilho */}
        <path
          d="M 16 104 A 84 84 0 0 1 184 104"
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Progresso */}
        {score !== null && (
          <path
            d="M 16 104 A 84 84 0 0 1 184 104"
            fill="none"
            stroke="url(#score-arc)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.3s ease-out" }}
          />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <p className={`text-5xl font-bold leading-none tracking-tight ${STATUS_TEXT_CLASS[status]}`}>
          {score === null ? "—" : <CountUp value={score} />}
        </p>
        <p className="mt-1 text-caption text-ink-faint">de 100</p>
      </div>
    </div>
  );
}

/** Pílula de dimensão com anel de progresso ao redor (nota 0-100). */
function DimensionPill({ label, score, status }: { label: string; score: number | null; status: HealthStatus }) {
  const [from, to] = STATUS_GRADIENT[status];
  const size = 64;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = (score ?? 0) / 100;
  const gradientId = `dim-${label.replace(/\s/g, "-")}`;
  const [offset, setOffset] = useState(c);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOffset(c * (1 - fraction)));
    return () => cancelAnimationFrame(raf);
  }, [c, fraction]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
          {score !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1.3s ease-out" }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-base font-bold ${STATUS_TEXT_CLASS[status]}`}>
            {score === null ? "—" : <CountUp value={score} />}
          </span>
        </div>
      </div>
      <p className="max-w-[5.5rem] text-center text-caption leading-tight text-ink-muted">{label}</p>
    </div>
  );
}

/** Card-âncora de "Análises": nota 0-100 de saúde financeira em arco + dimensões em anéis. */
export function HealthScoreCard({ score }: { score: FinancialHealthScore }) {
  return (
    <Card className="p-6">
      <p className="text-center text-label text-ink-muted">Sua saúde financeira</p>

      <div className="mt-3">
        <ScoreArc score={score.overallScore} status={score.status} />
      </div>

      <p className="mx-auto mt-3 max-w-sm text-center text-body text-ink-muted">{score.message}</p>

      <div className="mt-6 flex items-start justify-center gap-5 sm:gap-8">
        {score.dimensions.map((dimension) => (
          <DimensionPill key={dimension.key} label={dimension.label} score={dimension.score} status={dimension.status} />
        ))}
      </div>
    </Card>
  );
}
