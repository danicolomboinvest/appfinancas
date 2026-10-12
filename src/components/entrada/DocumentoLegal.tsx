import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { TelaDeEntrada, Titulo, Voltar } from "./pecas";

type Icone = ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }>;

/**
 * Privacidade e Termos no jeito novo (12/10/2026): o texto legal NÃO muda, muda a forma de ler.
 * No topo, "O essencial" em 3 cartões (o pedaço do Mockup B), que só resumem o que o texto já
 * diz; depois o índice clicável e o texto completo, seção por seção.
 */
export function DocumentoLegal({
  titulo,
  atualizacao,
  essencial,
  indice,
  children,
}: {
  titulo: string;
  atualizacao: string;
  essencial: { icone: Icone; texto: string }[];
  indice: { id: string; rotulo: string }[];
  children: ReactNode;
}) {
  return (
    <TelaDeEntrada larga>
      <Voltar href="/login" />
      <Titulo>{titulo}</Titulo>
      <p className="-mt-2 text-[13px] text-ink-muted">{atualizacao}</p>

      <section aria-labelledby="o-essencial" className="flex flex-col gap-2.5">
        <h2 id="o-essencial" className="text-[22px] font-medium tracking-[-0.02em]">
          O essencial
        </h2>
        <ul className="flex flex-col gap-2.5">
          {essencial.map(({ icone: I, texto }) => (
            <li
              key={texto}
              className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-[18px] bg-surface px-3.5 py-3 text-[15px] font-medium shadow-[inset_0_0_0_1px_var(--color-border)]"
            >
              <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-accent-soft text-accent-strong">
                <I size={20} strokeWidth={1.6} />
              </span>
              {texto}
            </li>
          ))}
        </ul>
      </section>

      <nav aria-labelledby="texto-completo" className="flex flex-col gap-2.5">
        <h2 id="texto-completo" className="text-[13px] font-semibold text-ink-muted">
          Texto completo
        </h2>
        <ol className="flex flex-col overflow-hidden rounded-[20px] bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]">
          {indice.map(({ id, rotulo }, i) => (
            <li key={id} className="border-t border-border first:border-t-0">
              <a
                href={`#${id}`}
                className="grid min-h-12 grid-cols-[26px_minmax(0,1fr)_16px] items-center gap-2 px-4 py-3 text-[15px] font-medium text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
              >
                <span className="text-[13px] font-bold text-accent-strong">{i + 1}</span>
                {rotulo}
                <ChevronRight size={16} strokeWidth={1.6} aria-hidden className="text-ink-muted" />
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="mt-2 flex flex-col gap-3 text-[15px] leading-relaxed text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink">
        {children}
      </article>
    </TelaDeEntrada>
  );
}

/** Um título de seção do texto legal, alvo do índice (a rolagem para com folga do topo). */
export function Secao({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-4 scroll-mt-[calc(16px+var(--safe-top,0px))] text-[17px] font-semibold text-ink">
      {children}
    </h2>
  );
}

export const LINK_LEGAL = "font-semibold text-accent-strong underline-offset-4 hover:underline";
