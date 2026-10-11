import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * As peças da lista de Configurações (versão nova, rodadas 25, 35 e 65): grupos com rótulo, linhas
 * no jeito dos Ajustes do iPhone (ícone num quadradinho da cor do grupo, nome, um subtítulo curto
 * com o estado de agora e a seta) e o cabeçalho igual em toda subpágina.
 */
export function Grupo({ titulo, children, id }: { titulo?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-2">
      {titulo && <h2 className="px-1 text-[13px] font-medium uppercase tracking-[0.08em] text-ink-muted">{titulo}</h2>}
      <div className="overflow-hidden rounded-3xl border border-border bg-surface">{children}</div>
    </section>
  );
}

export function Icone({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: cor }} aria-hidden>
      {children}
    </span>
  );
}

const LINHA = "flex min-h-[60px] w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left transition-colors first:border-t-0 hover:bg-surface-hover";

export function Linha({ href, icone, cor, rotulo, sub, externo, perigo }: { href: string; icone: ReactNode; cor: string; rotulo: string; sub?: string; externo?: boolean; perigo?: boolean }) {
  return (
    <Link href={href} {...(externo ? { target: "_blank", rel: "noopener" } : {})} className={LINHA}>
      <Icone cor={cor}>{icone}</Icone>
      <span className="min-w-0 flex-1">
        <span className={`block text-[16px] leading-snug ${perigo ? "text-danger" : "text-ink"}`}>{rotulo}</span>
        {sub && <span className="block truncate text-[13px] text-ink-muted">{sub}</span>}
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-faint" aria-hidden />
    </Link>
  );
}

/** O topo de toda subpágina: título no estilo do tema e uma linha cinza (rodada 62). */
export function Cabecalho({ titulo, sub }: { titulo: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="titulo-tema text-[28px] leading-tight text-ink">{titulo}</h1>
      {sub && <p className="text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

/** Um cartão de conteúdo com o respiro das outras páginas de Configurações. */
export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 ${className}`}>{children}</div>;
}
