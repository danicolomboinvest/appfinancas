import type { LucideIcon } from "lucide-react";

/**
 * Círculo CHEIO da cor da categoria, com o ícone em branco por cima.
 *
 * Era o contrário: fundo a 18% de opacidade e ícone colorido. Ficava discreto demais — num
 * app de finanças a lista de categorias é a tela mais olhada, e é o ícone que tem que puxar o
 * olho antes de qualquer texto. Cor cheia é o que faz a lista virar algo que se LÊ de relance
 * em vez de algo que se decifra linha por linha.
 *
 * `soft` mantém o tratamento antigo pra onde o ícone é acessório e não deve competir.
 */
export function CategoryIcon({
  icon: Icon,
  color,
  size = 40,
  variant = "solid",
}: {
  icon: LucideIcon;
  /** Cor da categoria, ex.: "var(--color-cat-alimentacao)", ver PARENT_CATEGORY_COLOR em categories.ts. */
  color: string;
  size?: 36 | 40 | 44 | 48;
  variant?: "solid" | "soft";
}) {
  const solid = variant === "solid";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: solid ? color : `color-mix(in srgb, ${color} 18%, transparent)`,
        color: solid ? "#ffffff" : color,
      }}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={2.1} />
    </div>
  );
}
