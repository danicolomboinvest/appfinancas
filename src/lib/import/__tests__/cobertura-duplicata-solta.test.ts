import { describe, expect, it } from "vitest";
import { casarPorDataEValor, descricaoNormalizada, mesmaDescricao, type ExistenteSolto } from "../duplicata-solta";

// Cobertura extra (set/2026). Lançamentos FICTÍCIOS.

const K = "2026-09-10|100.00|EXPENSE";
const mapa = (...descricoes: (string | null)[]) => new Map<string, ExistenteSolto[]>([[K, descricoes.map((descricao) => ({ descricao }))]]);

describe("descricaoNormalizada / mesmaDescricao: bordas", () => {
  it("espaço repetido, tab e símbolos viram um espaço só", () => {
    expect(descricaoNormalizada("  PIX\tENVIADO  --  Maria*Silva  ")).toBe("pix enviado maria silva");
    expect(descricaoNormalizada(null)).toBe("");
  });

  it("pedaço cortado precisa de 10 letras ou mais", () => {
    expect(mesmaDescricao("UBER TRIP", "UBER TRIP SAO PAULO")).toBe(false);
    expect(mesmaDescricao("UBER TRIP S", "UBER TRIP SAO PAULO")).toBe(true);
  });

  it("corte no meio da palavra conta (o CSV corta onde quiser)", () => {
    expect(mesmaDescricao("PIX ENVIADO MARIA SI", "PIX ENVIADO MARIA SILVA")).toBe(true);
  });

  it("não precisa ser o começo: pedaço no meio não é a mesma", () => {
    expect(mesmaDescricao("MARIA SILVA", "PIX ENVIADO MARIA SILVA")).toBe(false);
  });
});

describe("casarPorDataEValor: bordas", () => {
  it("item sem chave (null) não entra na comparação", () => {
    const r = casarPorDataEValor([null], ["PIX ENVIADO MARIA"], mapa("PIX ENVIADO MARIA"), { perguntar: true });
    expect(r.size).toBe(0);
  });

  it("chave diferente não casa, mesmo com descrição igual", () => {
    const r = casarPorDataEValor(["2026-09-11|100.00|EXPENSE"], ["PIX ENVIADO MARIA"], mapa("PIX ENVIADO MARIA"), { perguntar: true });
    expect(r.size).toBe(0);
  });

  it("igual, cortada e diferente: cada item acha o seu par certo", () => {
    const r = casarPorDataEValor(
      [K, K, K],
      ["PADARIA EXEMPLO", "Pix enviado Maria Sil", "SAQUE 24H"],
      mapa("SAQUE 24H", "PIX ENVIADO MARIA SILVA", "PADARIA EXEMPLO"),
      { perguntar: true },
    );
    expect([...r.values()]).toEqual([{ tipo: "mesmo" }, { tipo: "mesmo" }, { tipo: "mesmo" }]);
  });

  it("dois itens diferentes e um lançamento só: só um vira pergunta, o outro entra", () => {
    const r = casarPorDataEValor([K, K], ["SAQUE 24H", "TARIFA EXEMPLO"], mapa("PIX ENVIADO MARIA"), { perguntar: true });
    expect(r.size).toBe(1);
    expect(r.get(0)).toEqual({ tipo: "parecido", descricao: "PIX ENVIADO MARIA" });
  });

  it("o item já dado como existente (lançado à mão) não gasta a vaga de um importado diferente", () => {
    const r = casarPorDataEValor([K, K], ["Almoço com a equipe", "Pix enviado Maria"], mapa("PIX ENVIADO MARIA"), {
      perguntar: false,
      jaCasados: new Set([0]),
    });
    expect(r.get(1)).toEqual({ tipo: "mesmo" });
    expect(r.has(0)).toBe(false);
  });

  it("lista de existentes vazia pra chave não quebra", () => {
    const r = casarPorDataEValor([K], ["X"], new Map([[K, []]]), { perguntar: true });
    expect(r.size).toBe(0);
  });

  // `iguais` (duplicata-solta.ts) comparava "" com "" e dava verdadeiro; `mesmaDescricao` já
  // recusava descrição vazia. Um item sem descrição (ex.: OFX com MEMO vazio) era pulado CALADO
  // quando já existia outro sem descrição no mesmo dia e valor.
  it("descrição vazia dos dois lados não é 'o mesmo' automático", () => {
    const r = casarPorDataEValor([K], [""], mapa(null), { perguntar: true });
    expect(r.get(0)?.tipo).not.toBe("mesmo");
  });
});
