import type { MetaDaTela } from "@/lib/repositories/metas.repo";
import { mesDaqui, mesesAteOMes, mesesDaMeta } from "@/lib/metas/projecao";

/**
 * "Quando chego" (protótipo, rodada 32, proposta B "painel com projeção"): um gráfico só, com o
 * guardado (linha cheia, do início da meta até hoje), o plano até o prazo (tracejada) e o ritmo
 * atual até a bandeira (pontilhada). Embaixo, só "hoje" e a chegada; o prazo, quando a chegada
 * passa dele, fica em cima, colado na linha.
 */
export function GraficoQuandoChego({ meta, hoje }: { meta: MetaDaTela; hoje: Date }) {
  const { plano } = meta;
  const W = 300;
  const H = 110;
  const todos = mesesDaMeta(meta.inicio, hoje);
  const iHoje = todos.length - 1;
  const prazoN = meta.prazo ? mesesAteOMes(hoje, meta.prazo) : null;
  const chegaN = plano.chegaPeloRitmo ? plano.chega : null;
  const tot = prazoN !== null ? iHoje + prazoN : null;
  const ch = chegaN !== null ? iHoje + chegaN : null;
  const fim = Math.max(tot ?? 0, ch ?? 0, iHoje + 1);
  const X = (k: number) => +((k / fim) * W).toFixed(1);
  const Y = (v: number) => +(H - (Math.max(0, Math.min(v, meta.alvo)) / meta.alvo) * H).toFixed(1);
  const atrasada = plano.status === "BEHIND";
  const tarde = plano.tarde;

  // O saldo no fim de cada mês: o de hoje menos o que entrou depois daquele mês.
  const somas = todos.map((m) => meta.aportesPorMes.get(m.chave) ?? 0);
  const pontos = todos.map((_, k) => {
    const depois = somas.slice(k + 1).reduce((t, v) => t + v, 0);
    return `${X(k)},${Y(k === iHoje ? meta.guardado : meta.guardado - depois)}`;
  });
  const ancora = (v: number) => (v < 26 ? "start" : v > W - 26 ? "end" : "middle");
  const xh = X(iHoje);
  const xt = tot !== null ? X(tot) : null;
  const xc = ch !== null ? X(ch) : null;
  const xf = xc ?? xt;
  const pz = prazoN !== null ? mesDaqui(hoje, prazoN) : null;
  const cg = chegaN !== null ? mesDaqui(hoje, chegaN) : null;
  const prazoNoTopo = xc !== null && xt !== null && xc - xt >= 95;
  const rotulos: [number, string, boolean][] = [[xh, "hoje", false]];
  if (xc !== null && cg) rotulos.push([xc, `chega ${cg.curto}`, true]);
  else if (xt !== null && pz) rotulos.push([xt, `prazo ${pz.curto}`, true]);
  if (rotulos.length > 1 && rotulos[1][0] - xh < 74) rotulos.shift();

  return (
    <svg className="md-gb" viewBox={`-8 -24 ${W + 16} ${H + 48}`} role="img" aria-label={`Guardado, plano e quando chega${cg ? `: ${cg.texto}` : ""}`}>
      <line x1={0} y1={0} x2={W} y2={0} className="alvo" />
      {prazoNoTopo && xt !== null && pz && (
        <>
          <line x1={xt} y1={-6} x2={xt} y2={H} className="tick" />
          <text x={xt + 5} y={-10} className="lab">
            prazo {pz.curto}
          </text>
        </>
      )}
      {xt !== null && <polyline points={`0,${H} ${xt},0`} className="p" />}
      {xc !== null && meta.guardado < meta.alvo && <polyline points={`${xh},${Y(meta.guardado)} ${xc},0`} className={`j ${tarde ? "ruim" : ""}`} />}
      <polyline points={pontos.join(" ")} className="r" />
      {atrasada && plano.esperado !== null && xt !== null && <circle cx={xh} cy={Y(plano.esperado)} r={4} className="e" />}
      <circle cx={xh} cy={Y(meta.guardado)} r={5} className="h" />
      {xf !== null && <path transform={`translate(${Math.min(xf - 2, W - 12)},-22)`} d="M2 20V1h11l-2.5 4.5L13 10H2" className={`band ${tarde ? "ruim" : ""}`} />}
      {rotulos.map(([v, t, forte]) => (
        <text key={t} x={v} y={H + 20} textAnchor={ancora(v)} className={`lab ${forte ? "forte" : ""}`}>
          {t}
        </text>
      ))}
    </svg>
  );
}
