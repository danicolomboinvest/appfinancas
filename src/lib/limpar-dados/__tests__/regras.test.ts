import { describe, expect, it } from "vitest";
import { casalParaRecomecar, comecoParaRecomecar, confirmacaoValida, conexoesDosPerfis, ehEscopoDaLimpeza } from "../regras";

describe("confirmação digitada", () => {
  it("aceita LIMPAR com qualquer caixa e espaço nas pontas", () => {
    for (const v of ["LIMPAR", "limpar", " Limpar "]) expect(confirmacaoValida(v), v).toBe(true);
  });
  it("recusa o resto", () => {
    for (const v of ["", "LIMPA", "LIMPAR TUDO", "apagar", null, undefined, 1]) expect(confirmacaoValida(v), String(v)).toBe(false);
  });
});

describe("escopo", () => {
  it("só perfil ou todos", () => {
    expect(ehEscopoDaLimpeza("perfil")).toBe(true);
    expect(ehEscopoDaLimpeza("todos")).toBe(true);
    expect(ehEscopoDaLimpeza("conta")).toBe(false);
    expect(ehEscopoDaLimpeza(undefined)).toBe(false);
  });
});

describe("começo depois de limpar", () => {
  it("abre na porta do primeiro lançamento e guarda só o apelido e o que ela quer", () => {
    const c = comecoParaRecomecar({ passo: "porta", apelido: "Aninha", renda: 5000, quer: "dividas", lancou: "extrato", terminouEm: "2026-09-01", aha: true, bancos: ["nubank"] });
    expect(c).toMatchObject({ passo: "porta", apelido: "Aninha", quer: "dividas", renda: null, lancou: null, terminouEm: null, aha: false, bancos: [] });
  });
  it("quem nunca passou pelo começo novo também cai na porta", () => {
    expect(comecoParaRecomecar(null)).toMatchObject({ passo: "porta", apelido: null, quer: null });
  });
});

describe("combinado do casal depois de limpar", () => {
  it("tira só os meses acertados", () => {
    expect(casalParaRecomecar({ nomeA: "Ana", nomeB: "Léo", divisao: "renda", acertos: ["2026-08", "2026-09"], regras: { aluguel: "meio" } })).toEqual({
      nomeA: "Ana",
      nomeB: "Léo",
      divisao: "renda",
      acertos: [],
      regras: { aluguel: "meio" },
    });
  });
});

describe("bancos conectados do perfil", () => {
  const conexoes = [
    { id: "nu", connectorName: "Nubank" },
    { id: "itau", connectorName: "Itaú" },
    { id: "inter", connectorName: "Inter" },
    { id: "misto", connectorName: "C6" },
  ];
  const lotes = [
    { profileId: "pes", fileName: "Nubank · 01/10/2026" },
    { profileId: "pes", fileName: "Nubank · 02/10/2026" },
    { profileId: "emp", fileName: "Itaú · 01/10/2026" },
    { profileId: "pes", fileName: "C6 · 01/10/2026" },
    { profileId: "emp", fileName: "C6 · 05/10/2026" },
    { profileId: "pes", fileName: "Nubank Empresas · 01/10/2026" },
  ];
  it("sai só a conexão com todos os lotes nos perfis limpos", () => {
    expect(conexoesDosPerfis(conexoes, lotes, new Set(["pes"]))).toEqual(["nu"]);
  });
  it("conexão espalhada fica até limpar os dois perfis", () => {
    expect(conexoesDosPerfis(conexoes, lotes, new Set(["pes", "emp"])).sort()).toEqual(["itau", "misto", "nu"]);
  });
  it("conexão que nunca importou fica", () => {
    expect(conexoesDosPerfis(conexoes, lotes, new Set(["pes", "emp"]))).not.toContain("inter");
  });
});
