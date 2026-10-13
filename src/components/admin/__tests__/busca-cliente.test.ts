import { describe, expect, it } from "vitest";
import { bateComBusca } from "../BuscaCliente";

describe("bateComBusca", () => {
  it("acha por nome sem acento nem caixa", () => {
    expect(bateComBusca("vitoria", "Vitória Cardoso", "v@x.com")).toBe(true);
    expect(bateComBusca("CARDOSO", "Vitória Cardoso")).toBe(true);
  });
  it("acha por e-mail e por celular só com os dígitos", () => {
    expect(bateComBusca("elber@", null, "elber@gmail.com")).toBe(true);
    expect(bateComBusca("98765", null, null, "+55 (11) 98765-4321")).toBe(true);
  });
  it("busca vazia mostra todos e nome diferente não acha", () => {
    expect(bateComBusca("", "Ana")).toBe(true);
    expect(bateComBusca("lucas", "Ana", "ana@x.com")).toBe(false);
  });
});
