"use client";

import type { ParentCategory } from "@prisma/client";
import { Tag } from "lucide-react";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { useMoney } from "@/components/money/MoneyProvider";
import { PARENT_CATEGORY_ICON, isParentCategoryKey } from "@/lib/categories";
import type { GastoDeMarca } from "@/lib/money-reset/marcas-do-reset";

const iconeDa = (cat: string | null) => (cat && isParentCategoryKey(cat) ? PARENT_CATEGORY_ICON[cat as ParentCategory] : Tag);

/**
 * A fileira de marcas que ela paga, com o logo real e o valor por mês embaixo (pedido da Dani,
 * 12/10: "streaming, uma logozinha"). Rola de lado se não couber, sem cortar nada na tela.
 */
export function FileiraDeMarcas({ marcas, rotulo = "por mês", vezes = false }: { marcas: GastoDeMarca[]; rotulo?: string; vezes?: boolean }) {
  const money = useMoney();
  if (marcas.length === 0) return null;
  return (
    <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {marcas.map((g, i) => (
        <li key={g.slug} className="mr-entra flex w-[76px] shrink-0 flex-col items-center gap-1 text-center" style={{ animationDelay: `${i * 60}ms` }}>
          <LogoDoLancamento descricao={g.descricao} icon={iconeDa(g.parentCategory)} size={48} />
          <span className="w-full break-words leading-snug text-[12px] font-semibold text-ink">{g.nome}</span>
          <span className="text-[12px] tabular-nums text-ink-muted">{money(g.mensal, { round: true })}</span>
          <span className="-mt-1 text-[12px] text-ink-faint">{vezes && g.vezes >= 1.5 ? `${Math.round(g.vezes)}x ${rotulo}` : rotulo}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Logos do catálogo para quem ainda não tem dados: sempre com o selo "Exemplo" e nunca com valor
 * (regra: sem número inventado).
 */
export function LogosDeExemplo({ nomes, legenda }: { nomes: readonly string[]; legenda: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border-strong px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">Exemplo</span>
        <span className="text-right text-[12px] text-ink-muted">{legenda}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {nomes.map((n) => (
          <LogoDoLancamento key={n} descricao={n} icon={Tag} size={40} />
        ))}
      </div>
    </div>
  );
}

/** Um gasto com o logo à esquerda (lista do Raio-X, das contas fixas, das dívidas). */
export function LogoDoGasto({ descricao, categoria, size = 40 }: { descricao: string; categoria?: string | null; size?: 36 | 40 | 44 | 48 }) {
  return <LogoDoLancamento descricao={descricao} icon={iconeDa(categoria ?? null)} size={size} />;
}
