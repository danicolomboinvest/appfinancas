/**
 * "O que fazer esta semana": a lista de próximos passos derivada do ESTADO REAL da conta, não
 * uma lista fixa que todo mundo vê igual. Se a reserva já está completa, ela não aparece; se
 * o orçamento nunca foi definido, aparece em primeiro lugar.
 *
 * O ponto é tirar da pessoa o trabalho de descobrir sozinha o que fazer depois de abrir o app
 * — que é, olhando os dados de uso, exatamente onde a maioria trava e não volta.
 *
 * Funções puras (recebem números, devolvem a lista) pra dar pra testar as combinações.
 */

export type WeeklyTask = {
  key: string;
  label: string;
  /** Já resolvido — aparece riscado/marcado, mostrando o que a pessoa já fez. */
  done: boolean;
  href: string;
};

export type WeeklyTasksInput = {
  /** Lançamentos com data nos últimos 7 dias. */
  entriesThisWeek: number;
  /** Alguma categoria com valor planejado no mês. */
  hasBudget: boolean;
  /** Categorias que já passaram do planejado. */
  overBudgetCount: number;
  /** Progresso da reserva (0–1), null quando nem foi configurada. */
  emergencyProgress: number | null;
  /** Metas cadastradas e quantas estão atrasadas. */
  goalCount: number;
  goalsBehind: number;
  /** Aporte lançado no mês corrente. */
  investedThisMonth: number;
};

export function buildWeeklyTasks(input: WeeklyTasksInput): WeeklyTask[] {
  const tasks: WeeklyTask[] = [];

  // 1. O hábito-base: sem lançamento, nenhuma outra tela do app tem o que mostrar.
  tasks.push({
    key: "lancamentos",
    label:
      input.entriesThisWeek > 0
        ? `Gastos da semana registrados (${input.entriesThisWeek})`
        : "Registrar os gastos da semana",
    done: input.entriesThisWeek > 0,
    href: "/mensal",
  });

  // 2. Orçamento: definir vem antes de cobrar; só depois de existir plano faz sentido avisar
  // que estourou.
  if (!input.hasBudget) {
    tasks.push({
      key: "orcamento-definir",
      label: "Definir quanto quer gastar por categoria",
      done: false,
      href: "/orcamento",
    });
  } else if (input.overBudgetCount > 0) {
    tasks.push({
      key: "orcamento-estourado",
      label: `Revisar ${input.overBudgetCount} categoria${input.overBudgetCount === 1 ? "" : "s"} acima do orçamento`,
      done: false,
      href: "/orcamento",
    });
  } else {
    tasks.push({ key: "orcamento-ok", label: "Orçamento do mês sob controle", done: true, href: "/orcamento" });
  }

  // 3. Reserva de emergência: a prioridade número um de quem está organizando a vida financeira.
  if (input.emergencyProgress === null) {
    tasks.push({
      key: "reserva-configurar",
      label: "Definir sua reserva de emergência",
      done: false,
      href: "/planejamento/reserva-emergencia",
    });
  } else if (input.emergencyProgress < 1) {
    tasks.push({
      key: "reserva-completar",
      label: `Avançar na reserva de emergência (${Math.round(input.emergencyProgress * 100)}%)`,
      done: false,
      href: "/planejamento/reserva-emergencia",
    });
  } else {
    tasks.push({
      key: "reserva-ok",
      label: "Reserva de emergência completa",
      done: true,
      href: "/planejamento/reserva-emergencia",
    });
  }

  // 4. Metas: cobra o aporte de quem está atrasada; convida a criar quem ainda não tem nenhuma.
  if (input.goalCount === 0) {
    tasks.push({ key: "meta-criar", label: "Criar sua primeira meta", done: false, href: "/planejamento/metas" });
  } else if (input.goalsBehind > 0) {
    tasks.push({
      key: "meta-atrasada",
      label: `Retomar ${input.goalsBehind} meta${input.goalsBehind === 1 ? "" : "s"} atrasada${input.goalsBehind === 1 ? "" : "s"}`,
      done: false,
      href: "/planejamento/metas",
    });
  } else {
    tasks.push({ key: "meta-ok", label: "Metas no ritmo", done: true, href: "/planejamento/metas" });
  }

  // 5. Aporte do mês: o passo que transforma sobra em patrimônio.
  tasks.push({
    key: "aporte",
    label: input.investedThisMonth > 0 ? "Aporte do mês registrado" : "Separar o aporte do mês",
    done: input.investedThisMonth > 0,
    href: "/mensal",
  });

  return tasks;
}
