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
 * O TEMA muda a forma sem este componente saber qual tema é, por variáveis CSS que cada
 * tema declara (ver themes.ts): `--icon-radius` (círculo ou quadrado arredondado),
 * `--icon-fill` (cheio ou só contorno, no Minimalista), `--icon-glow` (o brilho do Game),
 * `--icon-overlay` (o degradê do Manifestação). A cor da categoria entra como `--cat` pra
 * essas variáveis poderem usá-la. Padrão: círculo cheio, como sempre foi.
 *
 * Com `emoji`, o emoji ganha do ícone (Girly e Sem filtro; quem decide é icones.ts).
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
  const solid = variant === "solid";
  const style: CSSProperties & Record<"--cat", string> = {
    "--cat": color,
    width: size,
    height: size,
    borderRadius: "var(--icon-radius, 999px)",
    backgroundColor: solid ? `color-mix(in srgb, ${color} var(--icon-fill, 100%), transparent)` : `color-mix(in srgb, ${color} 18%, transparent)`,
    backgroundImage: solid ? "var(--icon-overlay, none)" : "none",
    color: solid ? "var(--icon-ink, #ffffff)" : color,
    border: `var(--icon-border-width, 0px) solid ${color}`,
    boxShadow: solid ? "var(--icon-glow, none)" : "none",
  };
  return (
    <div className="flex shrink-0 items-center justify-center" style={style}>
      <Icon size={Math.round(size * 0.46)} strokeWidth={2.1} />
    </div>
  );
}
