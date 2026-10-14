import type { HTMLAttributes } from "react";

/**
 * O selinho do item (14/10/2026): a confirmação que fica no próprio item no lugar do aviso
 * solto ("pontual", "teto R$ 36", "quitada"). Uma ou duas palavras, minúsculas.
 */
export function Selinho({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold leading-tight text-accent-strong ${className}`}
    />
  );
}
