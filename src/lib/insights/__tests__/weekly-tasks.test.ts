import { describe, it, expect } from "vitest";
import { buildWeeklyTasks, type WeeklyTasksInput } from "../weekly-tasks";

const base: WeeklyTasksInput = {
  entriesThisWeek: 0,
  hasBudget: false,
  overBudgetCount: 0,
  emergencyProgress: null,
  goalCount: 0,
  goalsBehind: 0,
  investedThisMonth: 0,
};

const keys = (input: Partial<WeeklyTasksInput>) => buildWeeklyTasks({ ...base, ...input }).map((t) => t.key);
const find = (input: Partial<WeeklyTasksInput>, key: string) =>
  buildWeeklyTasks({ ...base, ...input }).find((t) => t.key === key);

describe("buildWeeklyTasks", () => {
  it("conta novata: tudo por fazer, nada marcado", () => {
    const tasks = buildWeeklyTasks(base);
    expect(tasks.every((t) => !t.done)).toBe(true);
    expect(keys({})).toEqual(["lancamentos", "orcamento-definir", "reserva-configurar", "meta-criar", "aporte"]);
  });

  it("conta em dia: tudo marcado", () => {
    const tasks = buildWeeklyTasks({
      entriesThisWeek: 4,
      hasBudget: true,
      overBudgetCount: 0,
      emergencyProgress: 1,
      goalCount: 2,
      goalsBehind: 0,
      investedThisMonth: 800,
    });
    expect(tasks.every((t) => t.done)).toBe(true);
  });

  it("cobra definir o orçamento antes de cobrar estouro", () => {
    // Sem orçamento definido, "estourou" não faz sentido — não havia teto.
    expect(keys({ hasBudget: false, overBudgetCount: 3 })).toContain("orcamento-definir");
    expect(keys({ hasBudget: false, overBudgetCount: 3 })).not.toContain("orcamento-estourado");
  });

  it("avisa do estouro só quando existe orçamento", () => {
    const task = find({ hasBudget: true, overBudgetCount: 2 }, "orcamento-estourado");
    expect(task?.label).toContain("2 categorias");
    expect(task?.done).toBe(false);
  });

  it("reserva incompleta mostra o quanto já andou", () => {
    expect(find({ emergencyProgress: 0.62 }, "reserva-completar")?.label).toContain("62%");
  });

  it("reserva completa vira item marcado, não some da lista", () => {
    expect(find({ emergencyProgress: 1 }, "reserva-ok")?.done).toBe(true);
  });

  it("singular/plural das metas atrasadas", () => {
    expect(find({ goalCount: 1, goalsBehind: 1 }, "meta-atrasada")?.label).toContain("1 meta atrasada");
    expect(find({ goalCount: 3, goalsBehind: 2 }, "meta-atrasada")?.label).toContain("2 metas atrasadas");
  });

  it("todo item aponta pra uma tela onde dá pra resolver", () => {
    for (const task of buildWeeklyTasks(base)) {
      expect(task.href.startsWith("/")).toBe(true);
    }
  });
});
