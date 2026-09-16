"use client";

/**
 * Faixa de saudação: quem é a pessoa e que dia é hoje. Só isso.
 *
 * Antes ela também trazia o saldo do mês e três pílulas com renda/gastos/aportes — e isso
 * estava ERRADO ao navegar. Os números vinham sempre do mês CORRENTE, porque a faixa vive no
 * layout, que não sabe qual mês a página está mostrando. Abrindo julho, a faixa dizia
 * "R$ 9,7 mil de renda" e o bloco logo abaixo dizia "R$ 13.500": dois conjuntos de números
 * para o mesmo mês, empilhados.
 *
 * Fora isso eram repetição — renda, gastos e aportes já aparecem no bloco Entrou/Saiu/Resultado
 * da própria tela, com o mês certo. O que sobrou aqui é o que é verdade em qualquer tela e em
 * qualquer mês: a saudação e a data de hoje.
 */
export function GreetingStrip({ greeting, dateLabel }: { greeting: string; dateLabel: string }) {
  return (
    <div className="mb-6 flex flex-col gap-0.5 border-b border-border pb-5">
      <p className="text-h2 font-serif font-normal italic tracking-tight text-ink">{greeting}</p>
      <p className="text-body text-ink-muted">{dateLabel}</p>
    </div>
  );
}
