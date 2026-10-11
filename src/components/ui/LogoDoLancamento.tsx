import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { marcaDaDescricao } from "@/lib/marcas/marca";

/**
 * O quadradinho à esquerda de um lançamento (versão nova, 11/10/2026, regra dos logos):
 *
 * - Marca de uma cor só (Netflix, iFood, Uber...): quadrado na cor oficial com o logo branco.
 * - Marca multicolorida (Itaú, Magalu...): quadrado branco com o logo como ele é.
 * - Sem logo conhecido: quadrado cinza com o ícone da categoria, no tom do texto.
 * - Nunca a inicial colorida: letra solta numa bolinha parece placeholder.
 *
 * A cor da marca vive só dentro do logo, para a lista não virar árvore de Natal.
 *
 * Sem "use client": recebe o ícone (uma função) de listas de servidor também, como o CategoryIcon.
 */
export function LogoDoLancamento({
  descricao,
  icon: Icon,
  emoji,
  size = 40,
}: {
  descricao: string | null | undefined;
  /** Ícone da categoria, para quando a marca não tem logo. */
  icon: LucideIcon;
  /** O emoji que a pessoa escolheu para a categoria: vale no lugar do ícone quando não há marca. */
  emoji?: string;
  size?: 36 | 40 | 44 | 48;
}) {
  const marca = marcaDaDescricao(descricao);
  const raio = Math.round(size * 0.3);
  const caixa: CSSProperties = { width: size, height: size, borderRadius: raio };

  if (!marca) {
    return (
      <div className="flex shrink-0 items-center justify-center bg-surface-2 text-ink-muted" style={{ ...caixa, fontSize: Math.round(size * 0.48), lineHeight: 1 }} aria-hidden>
        {emoji ?? <Icon size={Math.round(size * 0.45)} strokeWidth={1.6} />}
      </div>
    );
  }

  if (marca.mono) {
    const mascara = `url(${marca.src}) center / 58% no-repeat`;
    return (
      <div className="flex shrink-0 items-center justify-center" style={{ ...caixa, backgroundColor: marca.cor }} role="img" aria-label={marca.nome}>
        <span className="block size-full" style={{ backgroundColor: "#ffffff", WebkitMask: mascara, mask: mascara }} />
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden border border-border bg-white" style={caixa}>
      {/* eslint-disable-next-line @next/next/no-img-element -- logo pequeno e estático em /public; o otimizador não ganha nada aqui */}
      <img src={marca.src} alt={marca.nome} loading="lazy" decoding="async" className="size-[72%] object-contain" />
    </div>
  );
}
