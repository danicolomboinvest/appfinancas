/**
 * O livre do mês, um número só para todas as telas (decisão da dona, 15/10/2026).
 *
 * A Dani: "no orçamento ele tá pensando do futuro também... vai atualizando ao longo do mês". O
 * livre é o que o PLANO do mês ainda deixa gastar: o planejado de todas as categorias de gasto
 * menos tudo o que já saiu no mês. Começa grande e baixa conforme os gastos entram.
 *
 * Antes cada tela tinha a sua conta: o Orçamento e os Recorrentes diziam R$ 3.241, o Decidir, o
 * Posso comprar e o widget R$ 3.056 (eles cortavam pela renda e reservavam contas), e no dia 2 o
 * Posso comprar dizia "R$ 0" com o plano de novembro montado.
 *
 * A regra:
 * - planejado: a soma do plano do mês, todas as categorias (as padrão e as dela);
 * - gasto: todo gasto lançado no mês, com ou sem categoria, contando o "a vencer" (a conta com
 *   data mais para frente no mês já está no plano e já sai do livre, como no Orçamento);
 * - sem plano no mês: não há número ("Monte o plano de novembro"), nunca R$ 0;
 * - a renda NÃO muda o livre. Plano maior que a renda vira um aviso à parte (`passaDaRenda`);
 * - o valor vem em reais inteiros: toda tela mostra este mesmo `valor`, sem arredondar de novo
 *   (R$ 2.784 de um lado e R$ 2.785 do outro era arredondamento diferente).
 *
 * Mesmo padrão de lib/avisos: a conta é pura (`calcularLivreDoMes`) e quem lê o banco é
 * `carregarLivreDoMes` (lib/repositories/livre-do-mes.repo). Puro, sem banco: o cliente também
 * importa. Nenhuma tela refaz a conta.
 */

export type MesDoLivre = { ano: number; mes: number };

export type LivreDoMes =
  | { tipo: "semPlano"; ano: number; mes: number; passaDaRenda: null }
  | {
      tipo: "plano";
      ano: number;
      mes: number;
      /** O plano de gastos do mês (exato). */
      planejado: number;
      /** Tudo que já saiu no mês, com o "a vencer" (exato). */
      gasto: number;
      /** planejado − gasto, em reais inteiros. Negativo: passou do plano. É o número da tela. */
      valor: number;
      /**
       * Quanto o plano (gastos + guardar) passa da renda planejada do mês, em reais inteiros.
       * Null: cabe, ou não há renda planejada. Aviso à parte; não mexe no `valor`.
       */
      passaDaRenda: number | null;
    };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** A conta do livre e o arredondamento, num lugar só: planejado − gasto, em reais inteiros. */
export function valorDoLivre(planejado: number, gasto: number): number {
  return Math.round(planejado - gasto) || 0;
}

export function calcularLivreDoMes(e: MesDoLivre & { planejado: number; gasto: number; renda?: number | null; guardar?: number | null }): LivreDoMes {
  if (!(e.planejado > 0)) return { tipo: "semPlano", ano: e.ano, mes: e.mes, passaDaRenda: null };
  const valor = valorDoLivre(e.planejado, e.gasto);
  const renda = e.renda ?? null;
  const excesso = renda !== null && renda > 0 ? Math.round(e.planejado + Math.max(0, e.guardar ?? 0) - renda) : 0;
  return { tipo: "plano", ano: e.ano, mes: e.mes, planejado: e.planejado, gasto: e.gasto, valor, passaDaRenda: excesso >= 1 ? excesso : null };
}

/** O número da tela: o livre, ou zero quando passou do plano (para conta de quanto ainda cabe). */
export function livreOuZero(l: LivreDoMes): number {
  return l.tipo === "plano" ? Math.max(0, l.valor) : 0;
}

/** "Monte o plano de novembro": o que a tela diz quando o mês não tem plano. */
export function monteOPlano(l: Pick<LivreDoMes, "mes">): string {
  return `Monte o plano de ${MESES[l.mes - 1]}`;
}

/** "Seu plano passa da sua renda em R$ X": o aviso do "cabe na renda", à parte do livre. */
export function avisoDaRenda(l: LivreDoMes, money: (v: number) => string): string | null {
  return l.tipo === "plano" && l.passaDaRenda !== null ? `Seu plano passa da sua renda em ${money(l.passaDaRenda)}` : null;
}
