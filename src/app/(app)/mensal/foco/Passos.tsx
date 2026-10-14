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
      // Visual novo (13/10/2026): o bg-pill do tema Padrão é branco e sumia no cartão branco.
      className={`flex min-h-12 w-full items-center justify-center rounded-full px-5 py-2.5 text-center text-[15px] font-semibold leading-tight transition-opacity active:scale-[0.98] disabled:opacity-60 ${
        secundario ? "text-ink shadow-[inset_0_0_0_1.5px_var(--color-border-strong)]" : "botao-principal"
      }`}
    >
      {children}
    </button>
  );
}
