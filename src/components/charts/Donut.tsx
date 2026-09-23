"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_TOOLTIP_STYLE } from "./chart-theme";
import { FitText } from "@/components/ui/FitText";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

/**
 * A rosca do app — uma só, usada em gastos por categoria, divisão da renda e carteira.
 *
 * Antes eram três desenhos diferentes para a mesma ideia: um tinha total no centro e outro
 * não, um mostrava reais e outro só percentual, e as cores mudavam de tela para tela. Duas
 * roscas na mesma tela com paletas iguais chegavam a parecer o mesmo gráfico repetido. Com um
 * componente só, a pessoa aprende a ler uma vez e vale para o app inteiro.
 *
 * Três decisões que vêm do desenho aprovado:
 *  - o centro nunca fica vazio: é onde mora o total, que é a primeira pergunta de quem olha;
 *  - a legenda traz reais E percentual lado a lado — "27%" sozinho não dá para agir, "R$ 1.518"
 *    sozinho não dá para comparar;
 *  - passou de `maxSlices`, o excesso vira uma fatia "Outros": rosca com doze fatias é uma
 *    roda colorida, não um gráfico.
 */

export type DonutSlice = {
  /** Chave estável (dois ativos podem ter o mesmo nome). */
  id?: string;
  name: string;
  /** Valor absoluto; o percentual é calculado aqui, ninguém precisa mandar os dois. */
  value: number;
  color: string;
  /** Repassado no clique, pra tela saber o que abrir. */
  meta?: unknown;
};

const OUTROS_COLOR = "var(--color-ink-faint)";

/**
 * Raios da rosca a partir do lado da caixa.
 *
 * O raio é medido do CENTRO, então o máximo que cabe numa caixa de lado `size` é `size / 2` —
 * e não uma fração de `size`. Foi esse o erro: `size * 0.56` dava raio de 90 numa caixa de
 * 160, o círculo ia de -10 a 170 e o SVG cortava fora os quatro lados. Na tela isso não parece
 * um erro de conta, parece uma rosca com as bordas chanfradas, meio octogonal.
 *
 * Os 0,89 deixam uma folga: o `cornerRadius` e o `paddingAngle` engordam um pouco o desenho, e
 * encostar na borda exata volta a cortar.
 */
export function donutRadii(size: number): { inner: number; outer: number } {
  const outer = Math.round((size / 2) * 0.89);
  // 0,68 é a proporção do desenho original (68/100), a espessura de anel que foi aprovada.
  return { inner: Math.round(outer * 0.68), outer };
}

/**
 * O formato vai como PALAVRA, não como função. A rosca é Client Component e quem a usa quase
 * sempre é Server Component — passar `valueFormatter` dali estoura em runtime ("Functions
 * cannot be passed directly to Client Components"). Com um nome, o servidor manda uma string
 * e a formatação acontece deste lado.
 */
export type DonutFormat = "dinheiro" | "percent";

/** Junta a cauda em "Outros" — mantém o total honesto sem encher a rosca de lasquinhas.
 * O nome da fatia vem de fora (é a voz do tema); o `id` fica fixo porque é ele que a tela
 * usa pra saber que essa fatia não abre nada ao clicar. */
export function groupTail(slices: DonutSlice[], maxSlices: number, outrosLabel: string): DonutSlice[] {
  const sorted = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= maxSlices) return sorted;
  const head = sorted.slice(0, maxSlices - 1);
  const tail = sorted.slice(maxSlices - 1);
  return [
    ...head,
    {
      id: "__outros",
      name: outrosLabel,
      value: tail.reduce((sum, s) => sum + s.value, 0),
      color: OUTROS_COLOR,
    },
  ];
}

export function Donut({
  slices,
  centerLabel,
  centerValue,
  maxSlices = 6,
  format = "dinheiro",
  onSelect,
  selectedName,
  emptyMessage,
  size = 180,
}: {
  slices: DonutSlice[];
  /** Palavra curta acima do valor central, ex.: "Gastos", "Renda", "Total". */
  centerLabel: string;
  /** Quando ausente, mostra a soma das fatias formatada. */
  centerValue?: string;
  maxSlices?: number;
  format?: DonutFormat;
  onSelect?: (slice: DonutSlice) => void;
  selectedName?: string | null;
  /** Quando ausente, cai no "Sem dados ainda." do tema. */
  emptyMessage?: string;
  size?: number;
}) {
  const money = useMoney();
  const t = useProfileTheme().voz.titulos;
  const valueFormatter =
    format === "percent"
      ? (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
      : (value: number) => money(value, { round: true });
  const shown = groupTail(slices, maxSlices, t.grafOutros);
  const total = shown.reduce((sum, s) => sum + s.value, 0);

  if (shown.length === 0) {
    return <div className="flex h-44 items-center justify-center text-sm text-ink-faint">{emptyMessage ?? t.grafSemDados}</div>;
  }

  const { inner, outer } = donutRadii(size);

  return (
    // `@container` + `@md:` e não `sm:`: o que decide se cabe rosca e legenda lado a lado é a
    // largura do CARD, não a da tela. Duas roscas numa grade de duas colunas no desktop ficam
    // mais estreitas que uma rosca sozinha no celular — com breakpoint de viewport a legenda
    // era espremida até o nome da categoria sumir.
    <div className="@container">
      <div className="flex flex-col items-center gap-4 @md:flex-row @md:gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              nameKey="name"
              innerRadius={inner}
              outerRadius={outer}
              paddingAngle={2}
              cornerRadius={6}
              isAnimationActive={false}
              onClick={onSelect ? (entry) => onSelect(entry.payload as DonutSlice) : undefined}
              style={onSelect ? { cursor: "pointer" } : undefined}
            >
              {shown.map((entry) => (
                <Cell
                  key={entry.id ?? entry.name}
                  fill={entry.color}
                  stroke="none"
                  // Fatia escolhida em destaque: as outras recuam em vez de a escolhida saltar,
                  // senão a rosca muda de tamanho e o olho perde a referência.
                  opacity={selectedName && selectedName !== entry.name ? 0.35 : 1}
                />
              ))}
            </Pie>
            <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(value) => valueFormatter(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
        {/* O buraco da rosca tem ~96px: "R$ 1.164.901" a 18px passa por cima do anel. Encolhe. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[22%] text-center">
          <span className="text-caption text-ink-muted">{centerLabel}</span>
          <FitText className="text-lg font-semibold tabular-nums text-ink">{centerValue ?? valueFormatter(total)}</FitText>
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-col gap-0.5">
        {shown.map((slice) => {
          const percent = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          const clickable = Boolean(onSelect) && slice.id !== "__outros";
          const isSelected = selectedName === slice.name;
          const content = (
            <>
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: slice.color }} />
              <span className="min-w-14 flex-1 truncate text-left text-sm text-ink">{slice.name}</span>
              <span className="shrink-0 text-caption tabular-nums text-ink-muted">{valueFormatter(slice.value)}</span>
              <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">{percent}%</span>
            </>
          );
          return (
            <li key={slice.id ?? slice.name}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onSelect?.(slice)}
                  className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors ${
                    isSelected ? "bg-surface-2" : "hover:bg-surface-2"
                  }`}
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-1.5 py-1.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      </div>
    </div>
  );
}
