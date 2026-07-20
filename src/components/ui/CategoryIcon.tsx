import type { LucideIcon } from "lucide-react";

/**
 * Círculo translúcido colorido + ícone cheio — a assinatura visual de categoria do documento
 * de referência de design (fundo ~18% de opacidade da cor da categoria, ícone na cor cheia).
 * É o elemento que quebra o monocromático do app sem virar poluição visual.
 */
export function CategoryIcon({
  icon: Icon,
  color,
  size = 40,
}: {
  icon: LucideIcon;
  /** Cor da categoria, ex.: "var(--color-cat-alimentacao)" — ver PARENT_CATEGORY_COLOR em categories.ts. */
  color: string;
  size?: 36 | 40 | 44;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.9} />
    </div>
  );
}
