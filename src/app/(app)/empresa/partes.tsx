import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { Explica } from "@/components/ui/Explica";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import type { Forma } from "@/lib/empresa/config";
import { CreditCard, FileText, Banknote } from "lucide-react";

/**
 * As peças das telas da Empresa (versão nova, 11/10/2026). Tudo pinta com os tokens do tema
 * (`--color-*`), então os 4 temas, claro e escuro, saem daqui sem nenhum `if` de tema.
 */

export const CARTAO = "rounded-3xl border border-border bg-surface";

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${CARTAO} ${className}`}>{children}</div>;
}

/** "< Ateliê da Ana": volta para a Visão geral da empresa (ou para onde mandar). */
export function Voltar({ href = "/empresa", children }: { href?: string; children: ReactNode }) {
  return (
    <Link href={href} className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm text-ink-muted hover:text-ink">
      <ChevronLeft size={18} strokeWidth={1.8} aria-hidden />
      <span className="max-w-[16rem] truncate">{children}</span>
    </Link>
  );
}

/** O título grande da tela, na letra do tema ("Limite do MEI", "Seus clientes"). */
export function Titulo({ children, nota }: { children: ReactNode; nota?: ReactNode }) {
  return (
    <div className="px-1">
      <h1 className="titulo-tema text-[1.75rem] font-medium leading-tight text-ink">{children}</h1>
      {nota && <p className="mt-1 text-sm text-ink-muted">{nota}</p>}
    </div>
  );
}

/** O herói com um rótulo, o número grande e o que vier embaixo. */
export function Heroi({ rotulo, valor, ajuda, children }: { rotulo: ReactNode; valor: string; ajuda?: ReactNode; children?: ReactNode }) {
  return (
    <HeroiDoTema>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-heroi-suave">{rotulo}</p>
        {ajuda && <Explica noHeroi>{ajuda}</Explica>}
      </div>
      <ValorDestaque texto={valor} />
      {children}
    </HeroiDoTema>
  );
}

/** As iniciais do cliente num círculo ("CL" de Café Lume). */
export function Iniciais({ nome, className = "" }: { nome: string; className?: string }) {
  const ini = nome
    .split(/\s+/)
    .filter((p) => p && !["da", "de", "do", "das", "dos", "e"].includes(p.toLowerCase()))
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tracking-wide text-ink-muted shadow-[inset_0_0_0_1px_var(--color-border)] ${className}`} aria-hidden>
      {ini || "?"}
    </span>
  );
}

/** O logo do jeito de pagar: Pix com o logo do Pix; cartão e boleto com ícone (sem marca inventada). */
export function LogoDaForma({ forma, size = 36 }: { forma: Forma | null; size?: 36 | 40 }) {
  if (forma === "pix") return <LogoDoLancamento descricao="pix" icon={Banknote} size={size} />;
  const Icone = forma === "boleto" ? FileText : forma === "dinheiro" ? Banknote : CreditCard;
  return <LogoDoLancamento descricao={null} icon={Icone} size={size} />;
}

/** Uma linha do recibo: rótulo, pontilhado e o valor. */
export function LinhaDoRecibo({ rotulo, valor, menos = false, nota }: { rotulo: ReactNode; valor: string; menos?: boolean; nota?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 py-1.5 text-[15px]">
      <span className="shrink-0 text-ink">
        {rotulo}
        {nota && <small className="ml-1.5 text-xs text-ink-faint">{nota}</small>}
      </span>
      <span className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-border-strong" aria-hidden />
      <span className="shrink-0 tabular-nums text-ink">
        {menos ? "−" : ""}
        {valor}
      </span>
    </div>
  );
}

/** O picote do pé do recibo e do holerite. */
export function Picote() {
  return <span className="pointer-events-none absolute inset-x-0 -bottom-[7px] h-[14px] bg-[radial-gradient(circle_at_7px_7px,var(--color-canvas)_5px,transparent_5.5px)] bg-[length:14px_14px] bg-repeat-x" aria-hidden />;
}

/** As pílulas de escolha (Pix, Crédito, Café Lume...). */
export function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`min-h-11 rounded-full border px-4 text-[15px] transition-colors disabled:opacity-50 ${on ? "border-accent bg-accent-soft font-medium text-ink" : "border-border bg-surface text-ink hover:bg-surface-2"}`}
    >
      {children}
    </button>
  );
}

export const BOTAO_PRINCIPAL = "flex min-h-12 w-full items-center justify-center gap-2 rounded-full [background:var(--botao-fundo,var(--color-ink))] [color:var(--botao-tinta,var(--color-canvas))] [box-shadow:var(--botao-fio,none)] px-5 text-[15px] font-medium disabled:opacity-50";
export const BOTAO_SECUNDARIO = "flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface-2 px-5 text-[15px] text-ink disabled:opacity-50";

/** "novo" pequenininho no menu. */
export function SeloNovo() {
  return <em className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold not-italic uppercase tracking-wider text-accent-strong">novo</em>;
}
