import { describe, expect, it } from "vitest";
import { lugaresDosPerfis, podeCriar } from "../lugares";

const p = (id: string, kind: string, isDefault = false) => ({ id, name: id, kind, isDefault });
const nada = { casal: false, empresa: false };

describe("três lugares de perfil (rodada 74)", () => {
  it("conta nova: Pessoal em uso, Nós dois por R$ 27 e Empresa por R$ 37, cada um com a compra", () => {
    const { lugares, mantidos } = lugaresDosPerfis([p("Pessoal", "PESSOAL", true)], nada);
    expect(lugares.map((l) => [l.rotulo, l.liberado, l.preco, l.adicional])).toEqual([
      ["Pessoal", true, null, null],
      ["Nós dois", false, 27, "perfil_casal"],
      ["Empresa", false, 37, "perfil_empresa"],
    ]);
    expect(mantidos).toEqual([]);
  });

  it("quem já tem Casal e Empresa mantém; o lugar já vem liberado", () => {
    const { lugares } = lugaresDosPerfis([p("Pessoal", "PESSOAL", true), p("Nós dois", "CASAL"), p("Ateliê", "EMPRESA")], nada);
    expect(lugares.every((l) => l.liberado && l.perfil)).toBe(true);
  });

  it("cliente antiga com 5 perfis: os 3 lugares e os outros 2 mantidos", () => {
    const perfis = [p("Pessoal", "PESSOAL", true), p("Reforma", "PESSOAL"), p("Casa", "CASA"), p("Nós", "CASAL"), p("Loja", "EMPRESA")];
    const { lugares, mantidos } = lugaresDosPerfis(perfis, nada);
    expect(lugares.map((l) => l.perfil?.id)).toEqual(["Pessoal", "Nós", "Loja"]);
    expect(mantidos.map((m) => m.id)).toEqual(["Reforma", "Casa"]);
  });

  it("não cria perfil livre: só no lugar vazio e liberado", () => {
    const so = [p("Pessoal", "PESSOAL", true)];
    expect(podeCriar("CASAL", so, nada)).toBe(false);
    expect(podeCriar("CASAL", so, { casal: true, empresa: false })).toBe(true);
    expect(podeCriar("PESSOAL", so, { casal: true, empresa: true })).toBe(false);
    expect(podeCriar("CASA", so, { casal: true, empresa: true })).toBe(false);
  });
});
