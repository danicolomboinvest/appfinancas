import { describe, expect, it } from "vitest";
import { escolherTaxaDeReferencia } from "../taxa-de-referencia";

const global = { id: "seed-cdi", name: "CDI", userId: null, effectiveDate: new Date("2026-09-01") };
const minha = { id: "minha", name: "Meu CDI", userId: "u1", effectiveDate: new Date("2025-01-01") };
const minhaNova = { id: "minha-nova", name: "CDI", userId: "u1", effectiveDate: new Date("2026-06-01") };
const selic = { id: "selic", name: "Selic", userId: null, effectiveDate: new Date("2026-09-10") };

describe("escolherTaxaDeReferencia", () => {
  it("a taxa que ela cadastrou ganha da global, mesmo mais antiga e com outro nome", () => {
    expect(escolherTaxaDeReferencia([global, minha], "u1", /cdi/i)?.id).toBe("minha");
  });

  it("entre as dela, vale a de vigência mais recente", () => {
    expect(escolherTaxaDeReferencia([minha, global, minhaNova], "u1", /cdi/i)?.id).toBe("minha-nova");
  });

  it("sem taxa dela, cai na global mais recente que casa com o nome", () => {
    expect(escolherTaxaDeReferencia([global, selic], "u1", /cdi|selic/i)?.id).toBe("selic");
    expect(escolherTaxaDeReferencia([global], "u1", /cdi/i)?.id).toBe("seed-cdi");
  });

  it("taxa de outra pessoa não conta como dela; nada casando, nada volta", () => {
    expect(escolherTaxaDeReferencia([{ ...minha, userId: "u2" }, global], "u1", /cdi/i)?.id).toBe("seed-cdi");
    expect(escolherTaxaDeReferencia([selic], "u1", /cdi/i)).toBeUndefined();
  });
});
