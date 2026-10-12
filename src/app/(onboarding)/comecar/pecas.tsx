"use client";

import type { ReactNode } from "react";

/**
 * As peças de tela do começo, todas pintadas pelos tokens do tema (fundo, cartão, tinta, destaque):
 * a mesma tela sai Girly, Manifestação, Padrão ou Titânio, no claro e no escuro, sem saber qual.
 */

/** O título das telas: letra de título do tema (Cormorant itálica no Girly), com a 2ª parte forte. */
export function Titulo({ children, sub, centro = false, nivel = 2 }: { children: ReactNode; sub?: ReactNode; centro?: boolean; nivel?: 1 | 2 }) {
  const Tag = nivel === 1 ? "h1" : "h2";
  return (
    <Tag className={`titulo-tema text-[clamp(1.65rem,7.6vw,2rem)] font-normal leading-[1.12] text-ink ${centro ? "text-center" : ""}`}>
      {children}
      {sub && (
        <>
          {" "}
          <b className="font-semibold">{sub}</b>
        </>
      )}
    </Tag>
  );
}

export function Nota({ children, centro = false }: { children: ReactNode; centro?: boolean }) {
  return <p className={`text-sm font-medium leading-snug text-ink-muted ${centro ? "text-center" : ""}`}>{children}</p>;
}

/** Caixa de recado (chave, escudo): o porquê de uma pergunta. */
export function Recado({ icone, children }: { icone?: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-2xl bg-surface-2 px-3.5 py-3 text-sm font-medium leading-snug text-ink">
      {icone && <span className="mt-0.5 shrink-0 text-ink-muted">{icone}</span>}
      <span>{children}</span>
    </p>
  );
}

/** O pé das telas: o botão principal embaixo, largo, e um link discreto opcional. */
export function Pe({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col items-stretch gap-1.5 pt-4">{children}</div>;
}

export function BotaoPrincipal({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent shadow-premium-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function LinkDiscreto({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className={`mx-auto inline-flex min-h-11 items-center px-2 text-sm font-medium text-ink-muted underline decoration-border-strong underline-offset-4 hover:text-ink ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

/** Ícone redondo no tom do destaque, como os do protótipo. */
export function Bolinha({ children, tamanho = 40 }: { children: ReactNode; tamanho?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong" style={{ width: tamanho, height: tamanho }} aria-hidden>
      {children}
    </span>
  );
}

/** Pílula escolhível (categoria, moeda, atalho do gasto). */
export function Pilula({ ativa, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ativa?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={ativa}
      {...props}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
        ativa ? "border-accent bg-accent-soft text-ink shadow-[inset_0_0_0_1px_var(--color-accent)]" : "border-border bg-surface text-ink hover:border-border-strong"
      } ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/** Selo pequeno ("exemplo", "1 minuto"). */
export function Selo({ children, forte = false }: { children: ReactNode; forte?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${forte ? "bg-surface text-ink" : "bg-surface-2 text-ink-muted"}`}>{children}</span>
  );
}
