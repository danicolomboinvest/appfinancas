/**
 * A curva do mês (01/10/2026), como o topo do Copilot: o gasto acumulado dia a dia contra a linha
 * de ritmo ideal (o orçamento dividido pelos dias) e o mês passado, com a ponta pontilhada até
 * onde o mês fecha nesse ritmo. Mostra QUANDO saiu do trilho, o que a barra e a meia-lua não
 * mostravam. Server component, SVG puro.
 *
 * `compacta` (07/10/2026, "mesma cara, menos texto"): a mesma curva, baixinha e sem legenda, dentro
 * do cartão do número no Orçamento, como no Copilot e no Rocket Money. As linhas de referência
 * usam as cores do herói, para continuar legíveis nos temas de bloco pintado.
 */
const L = 300;
const ALTURA = 150;
const MARGEM = { esq: 6, dir: 6, topo: 22, base: 18 };
const MARGEM_COMPACTA = { esq: 5, dir: 5, topo: 6, base: 6 };

export function CurvaDoMes({
  acumulado,
  acumuladoAnterior,
  planejado,
  diasNoMes,
  previsao,
  marco,
  cor,
  money,
  compacta = false,
}: {
  acumulado: number[];
  acumuladoAnterior: number[];
  planejado: number;
  diasNoMes: number;
  previsao: number | null;
  marco: { dia: number; descricao: string } | null;
  cor: string;
  money: (v: number) => string;
  compacta?: boolean;
}) {
  const A = compacta ? 64 : ALTURA;
  const M = compacta ? MARGEM_COMPACTA : MARGEM;
  // Dentro do herói, as linhas de apoio na cor do texto suave dele; fora, os cinzas de sempre.
  const apoio = compacta ? "var(--color-heroi-suave)" : "var(--color-ink-faint)";
  const anteriorCor = compacta ? "color-mix(in srgb, var(--color-heroi-tinta) 22%, transparent)" : "var(--color-border-strong)";
  const topoValor = Math.max(planejado, previsao ?? 0, acumulado.at(-1) ?? 0, acumuladoAnterior.at(-1) ?? 0, 1) * 1.08;
  const x = (dia: number) => M.esq + ((dia - 1) / Math.max(1, diasNoMes - 1)) * (L - M.esq - M.dir);
  const y = (v: number) => A - M.base - (v / topoValor) * (A - M.topo - M.base);
  const linha = (vs: number[]) => vs.map((v, i) => `${i === 0 ? "M" : "L"}${x(i + 1).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const hoje = acumulado.length;
  const ultimo = acumulado.at(-1) ?? 0;
  const anterior = acumuladoAnterior.slice(0, diasNoMes);

  return (
    <>
    <svg viewBox={`0 0 ${L} ${A}`} className={compacta ? "block w-full" : "mt-2 block w-full"} role="img" aria-label={`Gasto acumulado até o dia ${hoje}: ${money(ultimo)}`}>
      {planejado > 0 && (
        <>
          {!compacta && (
            <>
              <line x1={M.esq} x2={L - M.dir} y1={y(planejado)} y2={y(planejado)} stroke={apoio} strokeDasharray="3 3" />
              <text x={L - M.dir} y={y(planejado) - 5} textAnchor="end" className="fill-ink-muted text-xs">
                planejado {money(planejado)}
              </text>
            </>
          )}
          <line x1={x(1)} y1={y(0)} x2={x(diasNoMes)} y2={y(planejado)} stroke={apoio} strokeWidth="1.5" strokeDasharray="5 4" />
        </>
      )}
      {anterior.length > 1 && <path d={linha(anterior)} fill="none" stroke={anteriorCor} strokeWidth="2" />}
      {previsao !== null && hoje > 0 && hoje < diasNoMes && (
        <line x1={x(hoje)} y1={y(ultimo)} x2={x(diasNoMes)} y2={y(previsao)} stroke={previsao > planejado ? "var(--color-danger)" : cor} strokeWidth="2" strokeDasharray="2 4" />
      )}
      {hoje > 1 && <path d={linha(acumulado)} fill="none" stroke={cor} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
      {hoje > 0 && <circle cx={x(hoje)} cy={y(ultimo)} r="4.5" fill={cor} />}
      {!compacta && marco && marco.dia <= hoje && (
        <>
          <circle cx={x(marco.dia)} cy={y(acumulado[marco.dia - 1])} r="3" fill="var(--color-surface)" stroke={cor} strokeWidth="2" />
          <text
            x={Math.min(Math.max(x(marco.dia), 60), L - 60)}
            y={Math.max(y(acumulado[marco.dia - 1]) - 9, 10)}
            textAnchor="middle"
            className="fill-ink-muted text-xs"
          >
            dia {marco.dia}: {marco.descricao.length > 22 ? `${marco.descricao.slice(0, 21)}…` : marco.descricao}
          </text>
        </>
      )}
      {!compacta && (
        <>
          <text x={x(1)} y={A - 3} className="fill-ink-faint text-xs">
            1
          </text>
          <text x={x(diasNoMes)} y={A - 3} textAnchor="end" className="fill-ink-faint text-xs">
            {diasNoMes}
          </text>
        </>
      )}
    </svg>
    {!compacta && (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-[3px] w-4 rounded-full" style={{ backgroundColor: cor }} /> este mês
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-4 border-t-2 border-dashed border-ink-faint" /> ritmo ideal
      </span>
      {anterior.length > 1 && (
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-border-strong" /> mês passado
        </span>
      )}
    </div>
    )}
    </>
  );
}
