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

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
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
