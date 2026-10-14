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
  it("várias palavras em qualquer ordem, com espaço a mais", () => {
    expect(bateComBusca("souza ana", "Ana Souza", "a@x.com")).toBe(true);
    expect(bateComBusca("ana  souza", "Ana Souza")).toBe(true);
    expect(bateComBusca("ana gmail", "Ana Souza", "ana@gmail.com")).toBe(true);
    expect(bateComBusca("ana lucas", "Ana Souza", "ana@gmail.com")).toBe(false);
  });
});
