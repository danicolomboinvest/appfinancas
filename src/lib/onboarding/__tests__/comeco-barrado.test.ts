import { describe, expect, it } from "vitest";
import { comecoBarrado } from "../comeco";

const base = { admin: false, parLiberado: false, confirmada: true, uso: "completo" as const };

describe("comecoBarrado", () => {
  it("compradora confirmada entra", () => {
    expect(comecoBarrado(base)).toBe(false);
  });
  it("sem confirmar o e-mail ou sem acesso, fica de fora", () => {
    expect(comecoBarrado({ ...base, confirmada: false })).toBe(true);
    expect(comecoBarrado({ ...base, uso: "bloqueado" })).toBe(true);
  });
  it("o par do Casal simples entra sem compra própria e sem confirmar (os cartões da Visão geral dele)", () => {
    expect(comecoBarrado({ admin: false, parLiberado: true, confirmada: false, uso: "bloqueado" })).toBe(false);
  });
  it("admin sempre entra", () => {
    expect(comecoBarrado({ admin: true, parLiberado: false, confirmada: false, uso: "bloqueado" })).toBe(false);
  });
});
