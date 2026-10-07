"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/** Os pontinhos de progresso e o cartão de um passo, iguais no ritual e no fechamento. */
export function Pontos({ total, atual }: { total: number; atual: number }) {
  return (
    <div className="flex justify-center gap-1.5" aria-label={`Passo ${atual + 1} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1 w-7 rounded-full ${i <= atual ? "bg-accent" : "bg-surface-2"}`} />
      ))}
    </div>
  );
}

export function Passo({ rotulo, titulo, children }: { rotulo: string; titulo?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <p className="text-caption font-semibold text-ink-muted">{rotulo}</p>
      {titulo && <div className="text-body font-semibold text-ink">{titulo}</div>}
      {children}
    </Card>
  );
}

export function Botao({ children, onClick, secundario = false, disabled = false }: { children: ReactNode; onClick: () => void; secundario?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-opacity disabled:opacity-60 ${
        secundario ? "border border-border text-ink-muted" : "bg-pill text-on-pill"
      }`}
    >
      {children}
    </button>
  );
}
