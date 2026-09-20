import type { ReactNode } from "react";
import type { ResumoDoMes } from "@/lib/planning/month-budget-summary";

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
}: {
  resumo: ResumoDoMes;
  /** "Setembro" */
  mesLabel: string;
  /** Último dia do mês, pro "até dia 30". */
  ultimoDia: number;
  money: (n: number, o?: { round?: boolean }) => string;
  /** Botão de atualizar, mostrado quando o mês está contado pela metade. */
  onAtualizar?: ReactNode;
}) {
  const { planejado, gasto, restante, usado, doMes, diasRestantes, porDia, situacao, ultimoDiaLancado, desatualizado } =
    resumo;

  // Vermelho é só pra quem estourou de verdade. "Adiantado" ainda tem dinheiro sobrando, e
  // pintar isso de vermelho colocava a barra em alarme logo acima de um "economia no mês" em
  // verde, na mesma tela — dois veredictos opostos sobre o mesmo mês. Âmbar é atenção, não susto.
  // Dado velho não recebe veredicto de cor. Pintar de verde um mês contado só até o dia 12 é
  // dizer "está tudo bem" sobre uma conta que ninguém terminou de fazer.
  const cor = desatualizado
    ? "var(--color-ink-faint)"
    : situacao === "estourou"
      ? "var(--color-danger)"
      : situacao === "adiantado"
        ? "var(--color-accent)"
        : situacao === "sem-plano"
          ? "var(--color-ink-faint)"
          : "var(--color-success)";

  const preenchimento = usado === null ? 0 : Math.min(Math.max(usado * 100, 0), 100);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-premium-sm sm:p-6">
      <p className="text-caption text-ink-muted">Seu orçamento de {mesLabel}</p>

      {/* O gasto é o número grande porque é o que a pessoa veio conferir; o planejado fica do
          lado, menor, como a régua dele. */}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-3xl font-semibold tabular-nums text-ink sm:text-4xl">{money(gasto, { round: true })}</span>
        {planejado > 0 && (
          <span className="text-base text-ink-muted sm:text-lg">de {money(planejado, { round: true })}</span>
        )}
      </div>

      <div className="relative mt-4 block h-3 rounded-full bg-surface-2">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${preenchimento}%`, backgroundColor: cor }}
        />
        {/* Mesmo tracinho das outras barras do app: onde o mês está. Passar dele é gastar
            adiantado, não é estourar — são coisas diferentes e a pessoa precisa ver as duas. */}
        {planejado > 0 && diasRestantes > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink/80"
            style={{ left: `calc(${Math.min(Math.max(doMes * 100, 0), 100)}% - 1px)` }}
          />
        )}
      </div>

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
          <p className="mt-3 text-sm text-ink">{frase({ situacao, restante, porDia, diasRestantes, ultimoDia, money })}</p>
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

function frase({
  situacao,
  restante,
  porDia,
  diasRestantes,
  ultimoDia,
  money,
}: {
  situacao: ResumoDoMes["situacao"];
  restante: number;
  porDia: number | null;
  diasRestantes: number;
  ultimoDia: number;
  money: (n: number, o?: { round?: boolean }) => string;
}): string {
  if (situacao === "sem-plano") {
    return "Você ainda não disse quanto quer gastar este mês. Defina ali embaixo e o app passa a te avisar antes de estourar.";
  }
  if (situacao === "estourou") {
    return `Você passou ${money(Math.abs(restante), { round: true })} do que tinha planejado.`;
  }
  // Mês fechado: não existe "por dia" pra frente, só o saldo final.
  if (porDia === null || diasRestantes === 0) {
    return `Sobrou ${money(restante, { round: true })} do planejado.`;
  }

  const sobra = `Sobram ${money(restante, { round: true })} para ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}: ${money(porDia, { round: true })} por dia até dia ${ultimoDia}.`;
  if (situacao === "adiantado") return `${sobra} Você está gastando adiantado para a altura do mês.`;
  if (situacao === "folgado") return `${sobra} Está sobrando mais do que o esperado — dá pra guardar a diferença.`;
  return sobra;
}
