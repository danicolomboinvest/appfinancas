import type { ReactNode } from "react";
import type { ResumoDoMes } from "@/lib/planning/month-budget-summary";
import type { Voz } from "@/lib/profiles/voice";

/**
 * O cartão que abre o orçamento: quanto você tinha, quanto já foi, e quanto isso dá por dia
 * até o fim do mês.
 *
 * Antes a página começava por "economia no mês" e "categoria que mais estourou" — duas
 * conclusões sobre um número que não aparecia em lugar nenhum. Quem abre o orçamento no dia 20
 * quer saber uma coisa só, e quer em dois segundos: ainda dá?
 *
 * O valor por dia é o que faz esse cartão valer a tela que ocupa. "Sobram R$ 1.150" é um número
 * pra guardar; "R$ 104 por dia até dia 30" é uma decisão que dá pra tomar na fila do mercado.
 */
export function ResumoDoMesCard({
  resumo,
  mesLabel,
  ultimoDia,
  money,
  onAtualizar,
  voz,
  grafico,
  previsaoTexto,
  previsaoRuim,
}: {
  /** O gráfico do mês (a curva). */
  grafico?: ReactNode;
  /** "Nesse ritmo, o mês fecha em R$ X": vem pronta da página. */
  previsaoTexto?: string | null;
  previsaoRuim?: boolean;
  resumo: ResumoDoMes;
  /** "Setembro" */
  mesLabel: string;
  /** Último dia do mês, pro "até dia 30". */
  ultimoDia: number;
  money: (n: number, o?: { round?: boolean }) => string;
  /** Botão de atualizar, mostrado quando o mês está contado pela metade. */
  onAtualizar?: ReactNode;
  /** O tema do perfil fala aqui: título ("Missão do mês 🎯" no Game) e a frase do "ainda dá?". */
  voz: Voz;
}) {
  const { planejado, gasto, restante, diasRestantes, porDia, situacao, ultimoDiaLancado, desatualizado } =
    resumo;


  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-premium-sm sm:p-6">
      <p className="text-caption text-ink-muted">{voz.tituloOrcamento(mesLabel)}</p>

      {/* O gasto é o número grande; o planejado do lado, menor, como a régua dele. */}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-3xl font-semibold tabular-nums text-ink sm:text-4xl">{money(gasto, { round: true })}</span>
        {planejado > 0 && <span className="text-base text-ink-muted sm:text-lg">de {money(planejado, { round: true })}</span>}
      </div>

      {/* A curva do mês (01/10/2026, aprovada pela Dani no lugar da barra): ver CurvaDoMes. */}
      {grafico}
      {previsaoTexto && <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${previsaoRuim ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>{previsaoTexto}</p>}

      {/* Quando o mês está contado pela metade, a conversa muda: não adianta dizer "ainda dá"
          sobre um número que não terminou de acontecer. A frase vira o convite pra completar. */}
      {desatualizado ? (
        <>
          <p className="mt-3 text-sm text-ink">
            {ultimoDiaLancado === null
              ? `Você ainda não lançou nenhum gasto de ${mesLabel}.`
              : `Seus gastos estão lançados até dia ${ultimoDiaLancado}. O que veio depois ainda não está nesta conta.`}
          </p>
          {onAtualizar}
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-ink">{voz.fraseOrcamento({ situacao, restante, porDia, diasRestantes, ultimoDia, money })}</p>
          {/* Só explica o tracinho quando a frase acima não explicou. Dizer "passou do tracinho =
              adiantado" logo abaixo de "você está gastando adiantado" é ocupar a tela repetindo. */}
          {planejado > 0 && diasRestantes > 0 && situacao === "no-ritmo" && (
            <p className="mt-0.5 text-caption text-ink-faint">O tracinho é onde o mês está hoje.</p>
          )}
        </>
      )}
    </section>
  );
}
