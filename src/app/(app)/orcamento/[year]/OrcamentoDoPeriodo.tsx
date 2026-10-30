import { Tag } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { getAnnualPlannedVsActual } from "@/lib/planning/budget-comparison";
import { listEntriesInInterval } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { rotulosDasPersonalizadas, type RotuloDaPersonalizada } from "@/lib/repositories/casa.repo";
import { CUSTOM_CATEGORY_ICON_MAP, categoryIcon, categoryLabel, colorForCategorySlice, isParentCategoryKey } from "@/lib/categories";
import { serverMoney } from "@/lib/money-server";
import { type Intervalo, rotuloDoIntervalo, soMesesInteiros } from "@/lib/visao-geral/periodo";
import { gastoPorCategoria, mesesDoIntervalo, planoDoIntervalo } from "@/lib/visao-geral/intervalo-dados";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { SeuPlano } from "@/components/budget/SeuPlano";

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * O Orçamento num período que não é um mês ("Ver o período", protótipo aplicaPer):
 * - meses inteiros (Trimestre passado, um personalizado de 1 de jul a 30 set): o plano somado dos
 *   meses, o que ficou acima ou abaixo dele e cada categoria "gasto de plano";
 * - pedaço de mês (Últimos 7 dias, Esse trimestre ainda correndo): "Orçamento é por mês · gastos
 *   do período", só o gasto de cada categoria, do maior para o menor.
 */
export async function OrcamentoDoPeriodo({ ctx, intervalo, agora }: { ctx: AuthContext; intervalo: Intervalo; agora: Date }) {
  const money = await serverMoney();
  const completo = soMesesInteiros(intervalo);
  const meses = mesesDoIntervalo(intervalo);
  const custom = await listCustomCategories(ctx);
  // Casal simples: a categoria que o par criou aparece com o nome e o ícone dele (só leitura).
  // Preenchido em cada caminho, com os ids que a tela vai mostrar.
  let personalizadas = new Map<string, RotuloDaPersonalizada>();
  const nome = (k: string) => (isParentCategoryKey(k) ? categoryLabel(ctx.categorias ?? ctx.profileKind, k) : (personalizadas.get(k)?.name ?? "Categoria personalizada"));
  const cor = (k: string) => colorForCategorySlice(isParentCategoryKey(k) ? { kind: "parent", value: k } : { kind: "custom", value: k }, ctx.categorias);
  const icone = (k: string) => (isParentCategoryKey(k) ? categoryIcon(ctx.categorias, k as ParentCategory) : (CUSTOM_CATEGORY_ICON_MAP[personalizadas.get(k)?.icon ?? ""] ?? Tag));
  const r = rotuloDoIntervalo(intervalo);
  const umDia = intervalo.de.ano === intervalo.ate.ano && intervalo.de.mes === intervalo.ate.mes && intervalo.de.dia === intervalo.ate.dia;

  if (!completo) {
    const gastos = gastoPorCategoria(await listEntriesInInterval(ctx, intervalo));
    personalizadas = await rotulosDasPersonalizadas(ctx, custom, gastos.map((c) => c.key));
    const maior = gastos[0]?.gasto ?? 1;
    const total = gastos.reduce((s, c) => s + c.gasto, 0);
    return (
      <div className="flex flex-col gap-4" data-orcamento-periodo="gastos">
        <h1 className="sr-only">Orçamento</h1>
        <div className="flex items-baseline justify-between gap-3 px-1">
          <p className="text-sm text-ink-muted">{umDia ? "Orçamento é por mês · gastos do dia" : "Orçamento é por mês · gastos do período"}</p>
          <p className="text-sm tabular-nums text-ink">{money(total, { round: true })}</p>
        </div>
        {gastos.length === 0 ? (
          <p className="px-1 py-3 text-sm text-ink-muted">Nenhum gasto nesse período.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {gastos.map((c) => (
              <li key={c.key} className="flex items-center gap-3 rounded-3xl border border-border bg-surface p-3">
                <CategoryIcon icon={icone(c.key)} color={cor(c.key)} size={44} variant="soft" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] text-ink">{nome(c.key)}</span>
                    <span className="shrink-0 text-sm tabular-nums text-ink">{money(c.gasto, { round: true })}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(c.gasto / maior) * 100}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const anos = [...new Set(meses.map((m) => m.year))];
  const comparacoes = await Promise.all(anos.map((y) => getAnnualPlannedVsActual(ctx, y)));
  const p = planoDoIntervalo(comparacoes, meses);
  personalizadas = await rotulosDasPersonalizadas(ctx, custom, p.categorias.map((c) => c.key));
  const hojeDentro = agora.getFullYear() * 12 + agora.getMonth() + 1 <= intervalo.ate.ano * 12 + intervalo.ate.mes;
  const dif = p.planejado - p.gasto;
  const titulo = intervalo.tipo === "custom" ? r.nome : r.sub;
  return (
    <div className="flex flex-col gap-6 lg:gap-5" data-orcamento-periodo="plano">
      <h1 className="sr-only">Orçamento</h1>
      {p.planejado > 0 && (
        <HeroiDoTema>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] text-heroi-suave">Plano de {titulo}</p>
            <p className="text-[15px] tabular-nums text-heroi-tinta">{money(p.planejado, { round: true })}</p>
          </div>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <ValorDestaque texto={money(Math.abs(dif), { round: true })} />
            <span className="text-[17px] text-heroi-suave">{hojeDentro && dif >= 0 ? "livres" : dif >= 0 ? "abaixo do plano" : "acima do plano"}</span>
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)]">
            <div className={`h-full rounded-full ${dif >= 0 ? "bg-[var(--color-heroi-tinta)]" : "bg-danger"}`} style={{ width: `${Math.min(100, (p.gasto / Math.max(1, p.planejado)) * 100)}%` }} />
          </div>
          <div className="flex items-baseline justify-between gap-3 text-sm text-heroi-suave">
            <span className="tabular-nums">Gastou {money(p.gasto, { round: true })}</span>
            <span className="tabular-nums">{Math.round((p.gasto / Math.max(1, p.planejado)) * 100)}%</span>
          </div>
        </HeroiDoTema>
      )}
      {p.semPlano.length > 0 && (
        <p className="px-1 text-sm text-ink-muted" data-meses-sem-plano>
          {p.semPlano.map((m) => MESES_CURTOS[m.month - 1]).join(" e ")} {p.semPlano.length > 1 ? "ainda não tinham" : "ainda não tinha"} plano: {money(p.semPlano.reduce((s, m) => s + m.gasto, 0), { round: true })} gastos fora desta conta.
        </p>
      )}
      {p.categorias.length > 0 && <SeuPlano meses={p.mesesComPlano} itens={p.categorias.map((c) => ({ key: c.key, label: nome(c.key), cor: cor(c.key), planejado: c.planejado, gasto: c.gasto }))} />}
      {p.categorias.length === 0 ? (
        <p className="px-1 py-3 text-sm text-ink-muted">Nenhum gasto nem plano nesse período.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {p.categorias.map((c) => {
            const passou = c.planejado > 0 && c.gasto > c.planejado;
            const uso = c.planejado > 0 ? (c.gasto / c.planejado) * 100 : 0;
            return (
              <li key={c.key} className="flex items-center gap-3 rounded-3xl border border-border bg-surface p-3">
                <CategoryIcon icon={icone(c.key)} color={cor(c.key)} size={44} variant="soft" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] text-ink">{nome(c.key)}</span>
                    {c.planejado > 0 && <span className={`shrink-0 text-sm tabular-nums ${passou ? "text-danger" : "text-ink"}`}>{Math.round(uso)}%</span>}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className={`h-full rounded-full ${passou ? "bg-danger" : "bg-ink"}`} style={{ width: `${Math.min(100, uso)}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-ink-muted">
                    {c.planejado > 0 ? `${money(c.gasto, { round: true })} de ${money(c.planejado, { round: true })}` : `${money(c.gasto, { round: true })}, sem plano`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
