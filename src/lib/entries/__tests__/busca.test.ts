import { describe, expect, it } from "vitest";
import { casaComABusca } from "../busca";

describe("busca de Transações", () => {
  it("acha sem acento", () => {
    expect(casaComABusca("pao", ["Pão de Açúcar", "Alimentação"], -121.6)).toBe(true);
    expect(casaComABusca("acucar", ["Pão de Açúcar"], -121.6)).toBe(true);
    expect(casaComABusca("Alimentacao", ["Pão de Açúcar", "Alimentação"], -121.6)).toBe(true);
  });
  it("acha pelo valor, do jeito que se escreve", () => {
    expect(casaComABusca("103,30", ["iFood"], -103.3)).toBe(true);
    expect(casaComABusca("103.30", ["iFood"], -103.3)).toBe(true);
    expect(casaComABusca("103", ["iFood"], -103.3)).toBe(true);
    expect(casaComABusca("R$ 7.700,00", ["Salário"], 7700)).toBe(true);
    expect(casaComABusca("7.700", ["Salário"], 7700)).toBe(true);
  });
  it("não acha o que não é", () => {
    expect(casaComABusca("103,31", ["iFood"], -103.3)).toBe(false);
    expect(casaComABusca("uber", ["iFood"], -103.3)).toBe(false);
    expect(casaComABusca("99", ["Uber"], -31.2)).toBe(false);
  });
  it("número no nome continua achando pelo nome", () => {
    expect(casaComABusca("99", ["99 Pop"], -15)).toBe(true);
  });
  it("busca vazia mostra tudo", () => expect(casaComABusca("  ", ["x"], 1)).toBe(true));
});
