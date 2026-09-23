import { Receipt } from "lucide-react";
import type { CategorySpending } from "@/lib/consolidation/month-analysis";
import { Section } from "@/components/ui/Section";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { emojiDaCategoria } from "@/lib/profiles/icones";
import type { ProfileKind } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import {
  categoryIcon,
  CUSTOM_CATEGORY_ICON_MAP,
  colorForCategorySlice,
  isParentCategoryKey,
} from "@/lib/categories";
import { serverMoney } from "@/lib/money-server";
import type { Voz } from "@/lib/profiles/voice";


/** Ranking não precisa ser infinito: as 5 primeiras já explicam a maior parte do mês, e a lista
 * completa continua a um toque de distância em "Só gastos". */
const TOP_COUNT = 5;

/**
 * "Para onde foi o dinheiro", em ordem. A rosca ao lado mostra a proporção; esta lista mostra
 * o nome, o valor e — o que faltava — se cada categoria subiu ou caiu em relação ao mês
 * passado. Sem essa última coluna a pessoa vê onde gastou, mas não descobre o que mudou.
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
  /** Tipo do perfil: numa Empresa o ícone de cada categoria-mãe é outro. A página passa `ctx.profileKind`. */
  kind?: ProfileKind;
}) {
  const money = await serverMoney();
  // Enquanto a página não passar o tipo, lemos da sessão pra Empresa nunca ver ícone de casa.
  const profileKind = kind ?? (await getRequiredSession()).profileKind;
  if (categories.length === 0) return null;
  const top = categories.slice(0, TOP_COUNT);
  const rest = categories.length - top.length;
  const t = voz.titulos;

  return (
    <Section
      title={t.uiMaioresGastos}
      action={rest > 0 ? <p className="text-caption text-ink-faint">{t.uiMaisCategorias(rest)}</p> : undefined}
    >
      <ul className="flex flex-col">
        {top.map((category) => {
          const icon =
            category.kind === "parent" && isParentCategoryKey(category.key)
              ? categoryIcon(profileKind, category.key)
              : (CUSTOM_CATEGORY_ICON_MAP[category.iconKey ?? ""] ?? Receipt);
          const color = colorForCategorySlice({ kind: category.kind, value: category.key });
          const emoji = category.kind === "parent" ? emojiDaCategoria(tema, { kind: "parent", value: category.key }) : emojiDaCategoria(tema, { kind: "custom", iconKey: category.iconKey });
          return (
            <li
              key={`${category.kind}:${category.key}`}
              className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0"
            >
              {/* Ícone cheio e grande é o que puxa o olho — a lista passa a ser lida pela cor
                  antes do texto. A barra de proporção saiu: ela competia com o ícone pela
                  atenção e dizia a mesma coisa que o percentual ao lado, com menos precisão. */}
              <CategoryIcon icon={icon} color={color} size={44} emoji={emoji} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-semibold leading-tight text-ink">{category.label}</p>
                <p className="mt-0.5 text-caption text-ink-muted">{t.uiContagemLancamentos(category.count)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[17px] font-semibold leading-tight tabular-nums text-ink">{money(category.amount)}</p>
                <p className="mt-0.5 text-caption tabular-nums text-ink-muted">
                  {Math.round(category.share * 100)}%
                  {category.changeRatio !== null && Math.abs(category.changeRatio) >= 0.08 && (
                    <span className={category.changeRatio > 0 ? " text-danger" : " text-success"}>
                      {" · "}
                      {category.changeRatio > 0 ? "↑" : "↓"}
                      {Math.round(Math.abs(category.changeRatio) * 100)}%
                    </span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-caption text-ink-faint">{t.uiSetaCompara}</p>
    </Section>
  );
}
