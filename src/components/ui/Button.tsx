import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  // First Light: o primário carrega a cor da marca, gradiente âmbar com texto
  // quase-preto quente (definidos em globals.css).
  primary: "bg-accent-gradient text-on-accent font-semibold hover:opacity-95 shadow-premium-sm disabled:hover:opacity-100",
  secondary:
    "bg-surface-2 text-ink border border-border-strong hover:bg-surface-hover",
  ghost: "bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink",
  danger: "bg-transparent text-danger hover:bg-danger-soft",
};

/**
 * Alvo de toque de 44px (WCAG 2.5.5 / Apple HIG): o público tem muita gente com dedo menos
 * certeiro e vista cansada. O md cresce de fato (min-h-11). O sm continua com a MESMA cara
 * compacta (~28px) — ele aparece em linha de lista e cartão apertado —, mas ganha uma área
 * invisível de 8px em cima e embaixo (o ::before), então o toque pega em 44px de altura.
 */
const SIZE_CLASSES: Record<Size, string> = {
  sm: "relative px-3 py-1.5 text-xs gap-1.5 before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']",
  md: "min-h-11 px-4 py-2.5 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full font-medium transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    />
  );
}
