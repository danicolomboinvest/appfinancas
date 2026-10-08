import type { ReactNode } from "react";
import { NumeroRolante } from "@/components/ui/NumeroRolante";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import type { ResumoDoMes } from "@/lib/planning/month-budget-summary";
import type { Voz } from "@/lib/profiles/voice";

/**
 * O cartão que abre o orçamento: quanto ainda dá para gastar no mês.
 *
 * Quem abre o orçamento no dia 20 quer saber uma coisa só, e quer em dois segundos: ainda dá?
 * Por isso o número grande é o que AINDA ESTÁ LIVRE (07/10/2026), com o quanto dá por dia num selo:
 * "Sobram R$ 1.150" é um número pra guardar; "R$ 104/dia" é uma decisão que dá pra tomar na fila do
 * mercado.
 *
 * Desde 07/10/2026 ("mesma cara, menos texto", aprovado pela Dani) sem nenhuma frase: a curva do
 * mês entra baixinha dentro do cartão e embaixo dela, nas pontas, o gasto e o plano. Quando o ritmo
 * leva a passar do plano, a ponta direita vira "Fecha em R$ X", em vermelho.
 */
export function ResumoDoMesCard({
  resumo,
  mesLabel,
  ultimoDia,
  money,
  onAtualizar,
  voz,
  grafico,
  previsao,
}: {
  /** A curva do mês, na versão compacta. */
  grafico?: ReactNode;
  /** Onde o mês fecha nesse ritmo (null quando não dá para prever). */
  previsao?: number | null;
  resumo: ResumoDoMes;
  /** "Setembro" */
  mesLabel: string;
  /** Último dia do mês, pro "até dia 30" da frase de quem ainda não tem plano. */
  ultimoDia: number;
  money: (n: number, o?: { round?: boolean }) => string;
  /** Botão de atualizar, mostrado quando o mês está contado pela metade. */
  onAtualizar?: ReactNode;
  /** O tema do perfil fala aqui: o rótulo do número e a frase de quem ainda não tem plano. */
  voz: Voz;
}) {
  const { planejado, gasto, restante, diasRestantes, porDia, situacao, ultimoDiaLancado, desatualizado } = resumo;
  const passou = restante < 0;
  const fechaAcima = !desatualizado && previsao != null && planejado > 0 && previsao > planejado;
  const r = (v: number) => money(v, { round: true });

  const selo = passou
    ? { texto: "Acima do plano", cor: "bg-danger text-white" }
    : porDia !== null
      ? { texto: `${r(porDia)}/dia`, cor: "bg-success text-white" }
      : diasRestantes === 0
        ? { texto: "Mês fechado", cor: "heroi-veu-forte" }
        : null;

  return (
    <section className="flex flex-col gap-3">
      <HeroiDoTema>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-heroi-suave">{voz.titulos.livreEm(mesLabel)}</p>
          {situacao !== "sem-plano" && selo && <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${selo.cor}`}>{selo.texto}</span>}
        </div>

        {situacao === "sem-plano" ? (
          <p className="text-lg font-semibold leading-snug">{voz.fraseOrcamento({ situacao, restante, porDia, diasRestantes, ultimoDia, money })}</p>
        ) : (
          <NumeroRolante texto={r(Math.abs(restante))} className="text-[2.75rem] font-bold leading-none tracking-tight tabular-nums" />
        )}

        {grafico}

        {planejado > 0 && (
          <div className="flex items-center justify-between gap-3 text-caption tabular-nums text-heroi-suave">
            <span>Gastou {r(gasto)}</span>
            {fechaAcima ? <span className="rounded-full bg-danger px-2 py-0.5 font-semibold text-white">Fecha em {r(previsao!)}</span> : <span>Plano {r(planejado)}</span>}
          </div>
        )}
      </HeroiDoTema>

      {/* Mês contado pela metade: não adianta dizer "ainda dá" sobre um número que não terminou de
          acontecer. A frase vira o convite para completar. */}
      {desatualizado && (
        <div className="flex flex-col gap-2 px-1">
          <p className="text-sm text-ink">
            {ultimoDiaLancado === null
              ? `Você ainda não lançou nenhum gasto de ${mesLabel}.`
              : `Gastos lançados até dia ${ultimoDiaLancado}.`}
          </p>
          {onAtualizar}
        </div>
      )}
    </section>
  );
}
