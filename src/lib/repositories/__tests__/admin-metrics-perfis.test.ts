import { describe, expect, it } from "vitest";
import { contaParaPoupanca } from "../admin-metrics.repo";

describe("contaParaPoupanca", () => {
  const naoPessoais = new Set(["perfil-empresa", "perfil-casal"]);

  it("lançamento do perfil pessoal entra", () => {
    expect(contaParaPoupanca("perfil-pessoal", naoPessoais)).toBe(true);
  });

  it("lançamento antigo, de antes dos perfis, entra (era todo pessoal)", () => {
    expect(contaParaPoupanca(null, naoPessoais)).toBe(true);
  });

  it("Empresa fica de fora: senão o pró-labore conta como gasto lá e renda aqui", () => {
    expect(contaParaPoupanca("perfil-empresa", naoPessoais)).toBe(false);
    expect(contaParaPoupanca("perfil-casal", naoPessoais)).toBe(false);
  });
});
