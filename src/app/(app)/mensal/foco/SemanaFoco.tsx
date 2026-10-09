import type { ReactNode } from "react";
import { NumeroRolante } from "@/components/ui/NumeroRolante";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import type { Ritmo } from "@/lib/profiles/voice-base";
import { diaDaSemana, previsaoDoMes } from "@/lib/decisoes/foco-semana";

const DIAS = ["S", "T", "Q", "Q", "S", "S", "D"];

/** A pílula do ritmo, por cima do herói pintado: o estado com palavra, nunca só a cor. */
const PILULA: Record<Ritmo, string> = {
  dentro: "bg-success text-white",
  limite: "heroi-veu-forte text-heroi-tinta",
  rapido: "bg-danger text-white",
};
/** A régua dos dias: hoje na cor do ritmo; no ritmo, a cor da marca do tema. */
const HOJE: Record<Ritmo, string> = { dentro: "bg-[var(--color-heroi-destaque)]", limite: "bg-[var(--color-heroi-destaque)]", rapido: "bg-danger" };

/**
 * O topo da Foco (01/10/2026): uma pergunta só, "quanto posso gastar?", respondida grande.
 * Desde 06/10/2026 num herói pintado na cor do tema (HeroiDoTema), com o ritmo numa pílula
 * com palavra. Os 7 tracinhos são a semana (o de hoje aceso).
 *
 * Embaixo, dois quadradinhos (07/10/2026, "mesma cara, menos texto"): quanto dá por dia e como o
 * mês fecha. Antes eram "R$ 181 por dia" ao lado do número e a frase "Seguindo assim, o mês fecha
 * com R$ 383 sobrando". A conta inteira abre ao tocar no cartão (ver ContaDoLivre).
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
  gastoUnico = 0,
  decorrido,
  diasRestantes,
  money,
  rotulos,
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
  /** Compra avulsa grande dentro do `gastoTotal`: a previsão conta uma vez só. */
  gastoUnico?: number;
  decorrido: number;
  diasRestantes: number;
  money: (v: number) => string;
  /** "Por dia" e "Fim do mês", na voz do tema. */
  rotulos: { porDia: string; fimDoMes: string };
  children?: ReactNode;
}) {
  const { indice, diasAteDomingo } = diaDaSemana(hoje);
  const dias = tipo === "semana" ? Math.min(diasAteDomingo, Math.max(1, diasRestantes)) : Math.max(1, diasRestantes);
  const porDia = Math.max(0, valor) / dias;
  const previsao = tipo === "estimativa" ? null : previsaoDoMes(planejado, gastoTotal, decorrido, gastoUnico);

  return (
    <HeroiDoTema>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-heroi-suave">{rotulo}</p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${PILULA[ritmo]}`}>{frase}</span>
      </div>
      <NumeroRolante texto={money(valor)} className="text-[2.75rem] font-bold leading-none tracking-tight tabular-nums" />

      {tipo === "semana" ? (
        <div className="flex flex-col gap-1" aria-label={`Hoje é o dia ${indice + 1} de 7 da semana`}>
          <div className="flex gap-1.5">
            {DIAS.map((_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i < indice ? "heroi-veu-forte" : i === indice ? `${HOJE[ritmo]} animate-pulse` : "heroi-veu"}`} />
            ))}
          </div>
          <div className="flex gap-1.5 text-xs text-heroi-suave">
            {DIAS.map((l, i) => (
              <span key={i} className={`flex-1 text-center ${i === indice ? "font-bold text-heroi-tinta" : ""}`}>
                {l}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="heroi-veu h-2 overflow-hidden rounded-full" aria-label={`${Math.round(decorrido * 100)}% do mês já passou`}>
          <div className={`h-2 rounded-full ${HOJE[ritmo]}`} style={{ width: `${Math.min(100, Math.round(decorrido * 100))}%` }} />
        </div>
      )}

      <div className="heroi-fio grid grid-cols-2 border-t pt-3">
        <div className="min-w-0">
          <p className="text-caption text-heroi-suave">{rotulos.porDia}</p>
          <p className="text-lg font-bold tabular-nums">{money(porDia)}</p>
        </div>
        {previsao !== null && (
          <div className="heroi-fio min-w-0 border-l pl-4">
            <p className="text-caption text-heroi-suave">{rotulos.fimDoMes}</p>
            <p className="text-lg font-bold tabular-nums">
              {previsao >= 0 ? "+" : "−"}
              {money(Math.abs(previsao))}
            </p>
          </div>
        )}
      </div>
      {children}
    </HeroiDoTema>
  );
}
