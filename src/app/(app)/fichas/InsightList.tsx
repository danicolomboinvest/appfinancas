"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Info } from "lucide-react";
import type { Insight, InsightTone } from "@/lib/insights";

const TONE_ICON: Record<InsightTone, typeof Info> = {
  danger: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

const TONE_COLOR: Record<InsightTone, string> = {
  danger: "text-danger",
  warning: "text-accent-strong",
  success: "text-success",
  info: "text-ink-faint",
};

/**
 * Análises resumidas (item 6): cada insight cabe em UMA linha (ícone de status + mensagem
 * truncada). O detalhe (mensagem completa + ação) só aparece ao tocar, nada de parágrafos
 * empilhados. Já vem ordenado por prioridade (danger → info) de computeInsights.
 */
export function InsightList({ insights }: { insights: Insight[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {insights.map((insight) => {
        const Icon = TONE_ICON[insight.tone];
        const isOpen = openId === insight.id;
        const hasDetail = insight.message.length > 0;
        return (
          <li key={insight.id}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : insight.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
            >
              <Icon size={16} strokeWidth={2} className={`shrink-0 ${TONE_COLOR[insight.tone]}`} />
              <span className={`min-w-0 flex-1 text-sm text-ink ${isOpen ? "" : "truncate"}`}>{insight.message}</span>
              {hasDetail && (
                <ChevronDown
                  size={15}
                  className={`shrink-0 text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>
            {isOpen && insight.href && (
              <div className="px-3 pb-2.5 pl-[2.375rem]">
                <Link
                  href={insight.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent-strong hover:underline"
                >
                  {insight.actionLabel ?? "Ver mais"} <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
