import { describe, expect, it } from "vitest";
import { levarDadosDoCasalParaOPessoal, registrarAvisoDoCasalNoPessoal } from "../casal-dados";

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

describe("o aviso de uma vez para a titular (30/10/2026)", () => {
  const dados = { userId: "titular", casalProfileId: "casal", pessoalProfileId: "pessoal" };
  it("com algo movido, deixa a Decisao sem resposta no Pessoal dela, com a chave do Casal", async () => {
    const criadas: unknown[] = [];
    const tx = { decisao: { create: async (a: { data: unknown }) => (criadas.push(a.data), {}) } };
    expect(await registrarAvisoDoCasalNoPessoal(tx, { ...dados, movidos: 128 })).toBe(true);
    expect(criadas).toEqual([{ userId: "titular", profileId: "pessoal", tipo: "casal_no_pessoal", chave: "casal", valor: 128, resolvidaEm: null }]);
  });
  it("Casal vazio: nada moveu, nada para avisar", async () => {
    const tx = { decisao: { create: async () => { throw new Error("não devia criar"); } } };
    expect(await registrarAvisoDoCasalNoPessoal(tx, { ...dados, movidos: 0 })).toBe(false);
  });
});
