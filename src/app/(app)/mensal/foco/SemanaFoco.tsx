import type { ReactNode } from "react";
import type { Ritmo } from "@/lib/profiles/voice-base";
import { diaDaSemana, previsaoDoMes } from "@/lib/decisoes/foco-semana";

const DIAS = ["S", "T", "Q", "Q", "S", "S", "D"];

const COR: Record<Ritmo, { fundo: string; forte: string; barra: string }> = {
  dentro: { fundo: "bg-success-soft", forte: "text-success", barra: "bg-success" },
  limite: { fundo: "bg-accent-soft", forte: "text-accent-strong", barra: "bg-accent" },
  rapido: { fundo: "bg-danger-soft", forte: "text-danger", barra: "bg-danger" },
};

/**
 * O topo da Foco (01/10/2026): uma pergunta só, "quanto posso gastar?", respondida grande e na
 * cor do ritmo. Os 7 tracinhos são a semana (o de hoje mais forte); embaixo, a frase de ritmo na
 * voz do tema e a previsão de como o mês fecha. A conta inteira continua no "Como cheguei nisso".
 */
export function SemanaFoco({
  rotulo,
  valor,
  tipo,
  hoje,
  ritmo,
  frase,
  planejado,
  gastoTotal,
  decorrido,
  diasRestantes,
  money,
  children,
}: {
  rotulo: string;
  valor: number;
  tipo: "semana" | "mes" | "estimativa";
  hoje: Date;
  ritmo: Ritmo;
  frase: string;
  planejado: number;
  gastoTotal: number;
  decorrido: number;
  diasRestantes: number;
  money: (v: number) => string;
  children?: ReactNode;
}) {
  const cor = COR[ritmo];
  const { indice, diasAteDomingo } = diaDaSemana(hoje);
  const dias = tipo === "semana" ? Math.min(diasAteDomingo, Math.max(1, diasRestantes)) : Math.max(1, diasRestantes);
  const porDia = Math.max(0, valor) / dias;
  const previsao = tipo === "estimativa" ? null : previsaoDoMes(planejado, gastoTotal, decorrido);

  return (
    <section className={`flex flex-col gap-3 rounded-3xl p-5 ${cor.fundo}`}>
      <p className="text-sm font-medium text-ink-muted">{rotulo}</p>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[2.75rem] font-bold leading-none tracking-tight text-ink tabular-nums">{money(valor)}</span>
        <span className="text-sm font-medium text-ink-muted">{money(porDia)} por dia</span>
      </div>

      {tipo === "semana" ? (
        <div className="flex flex-col gap-1" aria-label={`Hoje é o dia ${indice + 1} de 7 da semana`}>
          <div className="flex gap-1.5">
            {DIAS.map((_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i < indice ? `${cor.barra} opacity-40` : i === indice ? cor.barra : "bg-ink/10"}`} />
            ))}
          </div>
          <div className="flex gap-1.5 text-xs text-ink-faint">
            {DIAS.map((l, i) => (
              <span key={i} className={`flex-1 text-center ${i === indice ? `font-semibold ${cor.forte}` : ""}`}>
                {l}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-2 overflow-hidden rounded-full bg-ink/10" aria-label={`${Math.round(decorrido * 100)}% do mês já passou`}>
          <div className={`h-2 rounded-full ${cor.barra}`} style={{ width: `${Math.min(100, Math.round(decorrido * 100))}%` }} />
        </div>
      )}

      <p className={`text-sm font-semibold ${cor.forte}`}>{frase}</p>
      {previsao !== null && (
        <p className="text-sm text-ink">
          {previsao >= 0 ? (
            <>
              Seguindo assim, o mês fecha com <b className="tabular-nums">{money(previsao)}</b> sobrando.
            </>
          ) : (
            <>
              Seguindo assim, o mês passa <b className="tabular-nums">{money(-previsao)}</b> do planejado.
            </>
          )}
        </p>
      )}
      {children}
    </section>
  );
}
