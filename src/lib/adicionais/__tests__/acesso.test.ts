import { describe, expect, it } from "vitest";
import { decidirAdicional, type SituacaoDoAdicional } from "../acesso";
import { adicionalDoProdutoApple, ehAdicional, inicioDaCobranca } from "../config";

const LANCAMENTO = new Date("2026-11-03T03:00:00Z");
const base: SituacaoDoAdicional = {
  cobrancaDesde: LANCAMENTO,
  agora: new Date("2026-11-10T12:00:00Z"),
  admin: false,
  contaCriadaEm: new Date("2026-11-05T12:00:00Z"),
  acessoDesde: new Date("2026-11-05T12:00:00Z"),
  pagoNaHubla: false,
  pagoNaApple: false,
};

describe("decidirAdicional", () => {
  it("cobrança desligada ou antes do lançamento: todo mundo tem", () => {
    expect(decidirAdicional({ ...base, cobrancaDesde: null })).toBe(true);
    expect(decidirAdicional({ ...base, agora: new Date("2026-11-02T12:00:00Z") })).toBe(true);
  });

  it("cliente nova que não pagou não tem", () => {
    expect(decidirAdicional(base)).toBe(false);
  });

  it("pagou na Hubla ou na Apple: tem", () => {
    expect(decidirAdicional({ ...base, pagoNaHubla: true })).toBe(true);
    expect(decidirAdicional({ ...base, pagoNaApple: true })).toBe(true);
  });

  it("quem já era cliente antes do lançamento fica com tudo", () => {
    expect(decidirAdicional({ ...base, contaCriadaEm: new Date("2026-10-01T12:00:00Z") })).toBe(true);
    // Comprou antes do lançamento e só criou a conta depois: comprou com tudo incluído.
    expect(decidirAdicional({ ...base, acessoDesde: new Date("2026-10-20T12:00:00Z") })).toBe(true);
  });

  it("a Dani sempre tem", () => {
    expect(decidirAdicional({ ...base, admin: true })).toBe(true);
  });
});

describe("config dos adicionais", () => {
  it("lê a data do lançamento como meia-noite de Brasília, e data ruim desliga", () => {
    expect(inicioDaCobranca("2026-11-03")?.toISOString()).toBe("2026-11-03T03:00:00.000Z");
    expect(inicioDaCobranca(undefined)).toBeNull();
    expect(inicioDaCobranca("")).toBeNull();
    expect(inicioDaCobranca("amanhã")).toBeNull();
  });

  it("acha o adicional pelo produto da Apple", () => {
    expect(adicionalDoProdutoApple("com.danicolombo.spifinance.empresa.anual")).toBe("perfil_empresa");
    expect(adicionalDoProdutoApple("com.danicolombo.spifinance.casal.anual")).toBe("conta_parceiro");
    expect(adicionalDoProdutoApple("com.danicolombo.spifinance.anual")).toBeNull();
    expect(ehAdicional("perfil_empresa")).toBe(true);
    expect(ehAdicional("app")).toBe(false);
  });
});
