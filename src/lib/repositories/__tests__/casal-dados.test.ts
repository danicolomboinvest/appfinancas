import { describe, expect, it } from "vitest";
import { levarDadosDoCasalParaOPessoal } from "../casal-dados";

describe("dados da titular ao aceitar o convite", () => {
  it("move do Casal para o Pessoal só o que é dela e sem sobrescrever", async () => {
    const chamadas: { sql: string; args: unknown[] }[] = [];
    const tx = { $executeRawUnsafe: async (sql: string, ...args: unknown[]) => (chamadas.push({ sql, args }), 2) };
    const n = await levarDadosDoCasalParaOPessoal(tx, "titular", "casal", "pessoal");
    expect(n).toBeGreaterThan(0);
    const lancamentos = chamadas.find((c) => c.sql.startsWith('UPDATE "MonthlyEntry"'))!;
    expect(lancamentos.args).toEqual(["pessoal", "titular", "casal"]);
    expect(lancamentos.sql).toContain('"userId" = $2 AND "profileId" = $3');
    expect(lancamentos.sql).toContain("NOT EXISTS");
    const plano = chamadas.find((c) => c.sql.startsWith('UPDATE "MonthlyPlan"'))!;
    expect(plano.sql).toContain('"year"');
    expect(plano.sql).toContain('"month"');
    expect(chamadas.some((c) => c.sql.startsWith('UPDATE "Goal"'))).toBe(true);
  });

  it("não faz nada quando o Pessoal é o próprio Casal", async () => {
    const tx = { $executeRawUnsafe: async () => { throw new Error("não devia mexer"); } };
    expect(await levarDadosDoCasalParaOPessoal(tx, "u", "mesmo", "mesmo")).toBe(0);
  });
});
