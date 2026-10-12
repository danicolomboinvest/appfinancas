import type { ReactNode } from "react";

/**
 * A cena das historinhas (proposta A+B, vinda do caminho C): a Lu desenhada em CSS e o balão com o
 * que ela diz, sobre o fundo do herói do tema. O balão troca a cada toque (`fala` como key anima).
 */
export function CenaDaLu({ fala, children }: { fala: string; children?: ReactNode }) {
  return (
    <div
      className="flex min-h-40 flex-col gap-3 rounded-3xl border p-4"
      style={{ background: "var(--heroi-fundo, linear-gradient(145deg, var(--color-heroi-de), var(--color-heroi-para)))", color: "var(--color-heroi-tinta)", borderColor: "var(--color-heroi-borda, transparent)" }}
    >
      <div className="flex items-end gap-3">
        <span className="mr-lu" aria-hidden />
        <p key={fala} className="mr-entra heroi-veu rounded-2xl rounded-bl-md px-3 py-2 text-[15px] font-medium leading-snug" aria-live="polite">
          {fala}
        </p>
      </div>
      {children}
    </div>
  );
}
