import Link from "next/link";
import type { CategoriasDoPerfil } from "@/lib/categories";
import { Receipt } from "lucide-react";
import type { CategorySpending } from "@/lib/consolidation/month-analysis";
import { Section } from "@/components/ui/Section";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { emojiDaCategoria } from "@/lib/profiles/icones";
import { getRequiredSession } from "@/lib/auth/session";
import {
  categoryIcon,
  CUSTOM_CATEGORY_ICON_MAP,
  colorForCategorySlice,
  emojiEscolhido,
  isParentCategoryKey,
} from "@/lib/categories";
import { serverMoney } from "@/lib/money-server";
import type { Voz } from "@/lib/profiles/voice";


/** Ranking não precisa ser infinito: as 5 primeiras já explicam a maior parte do mês, e a lista
 * completa continua a um toque de distância em "Só gastos". */
const TOP_COUNT = 5;

/**
 * "Para onde foi o dinheiro", em ordem: o nome, o valor, a barra da fatia e se subiu ou caiu
 * em relação ao mês passado.
 *
 * É a ÚNICA lista de categorias do Mensal (07/10/2026, "mesma cara, menos texto"): antes havia
 * a rosca "Para onde foi" e esta lista "Maiores gastos", as mesmas categorias duas vezes. A
 * barra faz o papel da rosca; a contagem de lançamentos saiu (está na aba Gastos).
 */
export async function TopCategories({
  categories,
  tema,
  voz,
  kind,
}: {
  categories: CategorySpending[];
  /** Tema do perfil: no Girly o ícone vira emoji. */
  tema: string;
  /** A voz do tema do perfil, que a página já resolveu: o card não vai ao banco de novo por ela. */
  voz: Voz;
  /** Tipo do perfil (com o ícone que ela escolheu): numa Empresa o ícone de cada categoria-mãe é outro. */
  kind?: CategoriasDoPerfil;
}) {
  const money = await serverMoney();
  // Enquanto a página não passar o tipo, lemos da sessão pra Empresa nunca ver ícone de casa.
  const sessao = kind ? null : await getRequiredSession();
  const profileKind = kind ?? sessao?.categorias ?? sessao!.profileKind;
  if (categories.length === 0) return null;
  const top = categories.slice(0, TOP_COUNT);
  const rest = categories.length - top.length;
  const t = voz.titulos;

  return (
    <Section
      title={t.paraOndeFoi}
      hint={t.uiSetaCompara}
      action={
        <Link href="/mensal/gastos" className="text-caption font-medium text-accent-strong hover:underline">
          {rest > 0 ? t.uiMaisCategorias(rest) : "Ver lançamentos"}
        </Link>
      }
    >
      <ul className="flex flex-col">
        {top.map((category) => {
          const icon =
            category.kind === "parent" && isParentCategoryKey(category.key)
              ? categoryIcon(profileKind, category.key)
              : (CUSTOM_CATEGORY_ICON_MAP[category.iconKey ?? ""] ?? Receipt);
          const color = colorForCategorySlice({ kind: category.kind, value: category.key }, profileKind);
          const emoji = emojiEscolhido(profileKind, category.key) ?? (category.kind === "parent" ? emojiDaCategoria(tema, { kind: "parent", value: category.key }) : emojiDaCategoria(tema, { kind: "custom", iconKey: category.iconKey }));
          const pct = Math.round(category.share * 100);
          return (
            <li key={`${category.kind}:${category.key}`} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
              <CategoryIcon icon={icon} color={color} size={40} emoji={emoji} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-base font-semibold leading-tight text-ink">{category.label}</p>
                  <p className="shrink-0 text-base font-semibold leading-tight tabular-nums text-ink">{money(category.amount, { round: true })}</p>
                </div>
                <div className="mt-2 flex items-center gap-2.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, backgroundColor: color }} />
                  </div>
                  <span className="shrink-0 text-caption tabular-nums text-ink-muted">
                    {pct}%
                    {category.changeRatio !== null && Math.abs(category.changeRatio) >= 0.08 && (
                      <span className={category.changeRatio > 0 ? " text-danger" : " text-success"}>
                        {" "}
                        {category.changeRatio > 0 ? "↑" : "↓"}
                        {Math.round(Math.abs(category.changeRatio) * 100)}%
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
