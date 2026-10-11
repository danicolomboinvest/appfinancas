import { Plus } from "lucide-react";

/**
 * Peças visuais do login do par, iguais nas telas da titular e do par (protótipo aprovado,
 * casal-login-proposta.html): as duas bolinhas sobrepostas, o cartão e o botão escuro.
 *
 * A titular é sempre a cor de destaque do tema; o par, o azul acinzentado do protótipo. Cada um
 * aparece com a cor e a inicial dele, nunca só o nome.
 */

export const COR_DO_PAR = "#4E7396";

export const CARTAO =
  "rounded-[22px] bg-surface shadow-[inset_0_0_0_1px_var(--color-border),0_1px_2px_rgba(0,0,0,0.03),0_10px_30px_-18px_rgba(0,0,0,0.18)]";

export const BOTAO_ESCURO =
  "flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full bg-pill px-5 text-[17px] font-semibold text-on-pill transition-transform active:scale-[0.98] disabled:opacity-50";

export const BOTAO_CLARO =
  "flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full bg-surface px-5 text-[17px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-border),0_6px_18px_-12px_rgba(0,0,0,0.2)] transition-transform active:scale-[0.98] disabled:opacity-50";

export const BOTAO_SUAVE =
  "flex min-h-12 flex-1 items-center justify-center rounded-full bg-surface-2 px-4 text-[15px] font-semibold text-ink transition-transform active:scale-[0.98] disabled:opacity-50";

function inicial(nome: string): string {
  return (nome.trim().charAt(0) || "?").toUpperCase();
}

export function Bolinha({ nome, cor, size = 40, className = "" }: { nome: string; cor: "titular" | "par"; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-medium text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: cor === "titular" ? "var(--color-accent-strong)" : COR_DO_PAR }}
    >
      {inicial(nome)}
    </span>
  );
}

/**
 * As duas bolinhas grandes do topo. `par` nulo desenha o lugar vazio tracejado com "+" (ainda
 * sem par); `esperando` deixa a do par desbotada (convite enviado, ele ainda não entrou).
 */
export function ParDeAvatares({ titular, par, esperando = false, size = 64 }: { titular: string; par: string | null; esperando?: boolean; size?: number }) {
  return (
    <div className="flex items-center justify-center" aria-hidden>
      <Bolinha nome={titular} cor="titular" size={size} className="relative z-[1] ring-4 ring-canvas" />
      {par ? (
        <span style={{ marginLeft: -size * 0.18, opacity: esperando ? 0.45 : 1 }} className="relative">
          <Bolinha nome={par} cor="par" size={size} />
        </span>
      ) : (
        <span
          className="flex items-center justify-center rounded-full border border-dashed border-border-strong text-ink-muted"
          style={{ width: size, height: size, marginLeft: -size * 0.18 }}
        >
          <Plus size={Math.round(size * 0.3)} strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}

/** Título na letra de títulos do tema (no Girly, a Cormorant itálica). */
export function TituloDoTema({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h1 className={`titulo-tema text-balance text-center text-[34px] font-medium leading-[1.12] tracking-tight text-ink ${className}`}>{children}</h1>;
}
