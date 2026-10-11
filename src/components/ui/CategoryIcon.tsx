import type { CSSProperties } from "react";
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
 *
 * Com `emoji` (o que a própria pessoa escolheu para a categoria), o emoji ganha do ícone.
 *
 * Este componente NÃO pode virar "use client": ele recebe o ícone (uma função) de listas que
 * são de servidor, e o React não deixa função atravessar essa fronteira. Foi exatamente o
 * erro que derrubou a Visão mensal na primeira versão do emoji.
 */
export function CategoryIcon({
  icon: Icon,
  color,
  size = 40,
  variant = "solid",
  emoji,
}: {
  icon: LucideIcon;
  /** Cor da categoria, ex.: "var(--color-cat-alimentacao)", ver PARENT_CATEGORY_COLOR em categories.ts. */
  color: string;
  size?: 36 | 40 | 44 | 48;
  variant?: "solid" | "soft";
  /** O emoji desta categoria no tema ativo (ver src/lib/profiles/icones.ts). */
  emoji?: string;
}) {
  if (emoji) {
    return (
      <div
        className="flex shrink-0 items-center justify-center bg-surface-2"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5), lineHeight: 1, borderRadius: "var(--icon-radius, 999px)" }}
        aria-hidden
      >
        {emoji}
      </div>
    );
  }
  // Versão nova (11/10/2026): ícone de traço fino dentro de um círculo no tom da categoria, todos
  // do mesmo jeito nos quatro temas. O "solid" ficou com o mesmo desenho, um pouco mais marcado.
  const solid = variant === "solid";
  const style: CSSProperties & Record<"--cat", string> = {
    "--cat": color,
    width: size,
    height: size,
    borderRadius: "999px",
    backgroundColor: `color-mix(in srgb, ${color} ${solid ? 16 : 12}%, transparent)`,
    color,
  };
  return (
    <div className="flex shrink-0 items-center justify-center" style={style}>
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.6} />
    </div>
  );
}
