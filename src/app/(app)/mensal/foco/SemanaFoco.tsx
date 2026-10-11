import type { ReactNode } from "react";
import { NumeroRolante } from "@/components/ui/NumeroRolante";
import { NUMERO_DESTAQUE, ValorDestaque } from "@/components/ui/ValorDestaque";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import type { Ritmo } from "@/lib/profiles/voice-base";
import { diaDaSemana, previsaoDoMes } from "@/lib/decisoes/foco-semana";

const DIAS = ["S", "T", "Q", "Q", "S", "S", "D"];

/** A régua dos dias: hoje na cor do ritmo; no ritmo, a cor da marca do tema. */
const HOJE: Record<Ritmo, string> = { dentro: "bg-[var(--color-heroi-tinta)]", limite: "bg-[var(--color-heroi-destaque)]", rapido: "bg-danger" };

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
  fimDoMesDoPlano = null,
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
  /**
   * Mês ainda sem lançamento ("estimativa"): o mesmo desenho da semana, e o "Fim do mês" vem do
   * plano (ver fimDoMesPeloPlano), nunca de um ritmo inventado. Null: o quadrinho some.
   */
  fimDoMesDoPlano?: number | null;
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
  // A semana (S T Q Q S S D) vale também para o mês sem lançamento: é o desenho aprovado.
  const daSemana = tipo === "semana" || tipo === "estimativa";
  const dias = daSemana ? Math.min(diasAteDomingo, Math.max(1, diasRestantes)) : Math.max(1, diasRestantes);
  const porDia = Math.max(0, valor) / dias;
  const previsao = tipo === "estimativa" ? fimDoMesDoPlano : previsaoDoMes(planejado, gastoTotal, decorrido, gastoUnico);

  return (
    <HeroiDoTema>
      {/* Versão nova (protótipo aprovado): o rótulo, o número leve e grande, a régua da semana e
          dois quadrinhos de vidro (por dia e fim do mês). O ritmo fala pela cor do tracinho de
          hoje e pelo nome no leitor de tela; a pílula com texto saiu do herói. */}
      <p className="text-[15px] text-heroi-suave">
        {rotulo}
        <span className="sr-only">. {frase}</span>
      </p>
      <NumeroRolante texto={money(valor)} className={NUMERO_DESTAQUE} />

      {daSemana ? (
        <div className="flex flex-col gap-1.5" aria-label={`Hoje é o dia ${indice + 1} de 7 da semana`}>
          <div className="flex gap-1.5">
            {DIAS.map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${i < indice ? "bg-[color-mix(in_srgb,var(--color-heroi-tinta)_32%,transparent)]" : i === indice ? HOJE[ritmo] : "bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)]"}`}
              />
            ))}
          </div>
          <div className="flex gap-1.5 text-xs text-heroi-suave">
            {DIAS.map((l, i) => (
              <span key={i} className={`flex-1 text-center ${i === indice ? "font-semibold text-heroi-tinta" : ""}`}>
                {l}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)]" aria-label={`${Math.round(decorrido * 100)}% do mês já passou`}>
          <div className={`h-1 rounded-full ${HOJE[ritmo]}`} style={{ width: `${Math.min(100, Math.round(decorrido * 100))}%` }} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <div className="vidro-heroi min-w-0 rounded-2xl px-3.5 py-3">
          <p className="text-caption text-heroi-suave">{rotulos.porDia}</p>
          <ValorDestaque texto={money(porDia)} className="mt-0.5 text-[1.25rem] font-normal tabular-nums" />
        </div>
        {previsao !== null && (
          <div className="vidro-heroi min-w-0 rounded-2xl px-3.5 py-3">
            <p className="text-caption text-heroi-suave">{rotulos.fimDoMes}</p>
            <ValorDestaque texto={`${previsao >= 0 ? "+" : "−"}${money(Math.abs(previsao))}`} className="mt-0.5 text-[1.25rem] font-normal tabular-nums" />
          </div>
        )}
      </div>
      {children}
    </HeroiDoTema>
  );
}
