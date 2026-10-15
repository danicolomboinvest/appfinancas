import { describe, expect, it } from "vitest";
import { dasEstimado, ferramentasDoMei, origemDaGuia, textoDaGuia, valorDaGuia, type ParametrosDoMei } from "../legal";
import { lerConfigEmpresa } from "../config";
import { guiaDoMeiDaEmpresa, resumoDaEmpresa } from "../resumo";
import type { LancamentoDaEmpresa } from "../regras";

/** Os números de 2026 da migration 20261015180000 (Receita Federal, 02/01/2026). */
const fonte = { fonte: "Receita Federal", fonteData: "2026-01-02" };
const legal: ParametrosDoMei = {
  teto: null,
  tolerancia: null,
  das: { valor: 86.05, ...fonte },
  diaDoDas: { valor: 20, ...fonte },
  salarioMinimo: { valor: 1621, ...fonte },
  inssPercentual: { valor: 5, ...fonte },
  icms: { valor: 1, ...fonte },
  iss: { valor: 5, ...fonte },
};
const soAGuiaDeServico: ParametrosDoMei = { teto: null, tolerancia: null, das: legal.das, diaDoDas: legal.diaDoDas };

describe("a guia estimada pela atividade do MEI", () => {
  it("INSS de 5% do mínimo (R$ 81,05) mais ISS e/ou ICMS", () => {
    expect(dasEstimado(legal, "servico")?.valor).toBe(86.05);
    expect(dasEstimado(legal, "comercio")?.valor).toBe(82.05);
    expect(dasEstimado(legal, "comercio_servico")?.valor).toBe(87.05);
  });
  it("sem as partes na tabela, só o serviço tem número (a chave de antes)", () => {
    expect(dasEstimado(soAGuiaDeServico, "servico")?.valor).toBe(86.05);
    expect(dasEstimado(soAGuiaDeServico, "comercio")).toBeNull();
  });
  it("Impostos aparece para o MEI com as partes, mesmo sem a guia inteira", () => {
    expect(ferramentasDoMei("MEI", { ...legal, das: null }).impostos).toBe(true);
  });
});

describe("a fonte única do valor da guia", () => {
  const digitada = { valor: 92.3, em: "2026-10-15" };
  it("sem nada, a estimativa", () => {
    expect(valorDaGuia({ legal, atividade: "comercio", digitada: null, ultimaPaga: null })).toEqual({ valor: 82.05, origem: "estimada" });
  });
  it("a última guia paga ganha da estimativa (como antes)", () => {
    expect(valorDaGuia({ legal, atividade: "servico", digitada: null, ultimaPaga: { valor: 80.9, dia: "2026-09-18" } })).toEqual({ valor: 80.9, origem: "paga" });
  });
  it("o valor digitado ganha da estimativa e da guia paga ANTES dele", () => {
    expect(valorDaGuia({ legal, atividade: "servico", digitada, ultimaPaga: null })).toEqual({ valor: 92.3, origem: "digitada" });
    expect(valorDaGuia({ legal, atividade: "servico", digitada, ultimaPaga: { valor: 80.9, dia: "2026-09-18" } })).toEqual({ valor: 92.3, origem: "digitada" });
  });
  it("a guia paga DEPOIS do digitado ganha dele", () => {
    expect(valorDaGuia({ legal, atividade: "servico", digitada, ultimaPaga: { valor: 93.1, dia: "2026-10-20" } })).toEqual({ valor: 93.1, origem: "paga" });
  });
  it("o rótulo diz de onde veio, sem travessão", () => {
    expect(origemDaGuia({ valor: 1, origem: "estimada" })).toBe("estimado pelo app");
    expect(origemDaGuia({ valor: 1, origem: "digitada" })).toBe("da sua guia");
  });
  it("o ? diz a estimativa da atividade e qual valor o app usa", () => {
    const t = textoDaGuia(legal, "comercio", { valor: 92.3, origem: "digitada" })!;
    expect(t).toContain("comércio ou indústria");
    expect(t).toContain("82,05");
    expect(t).toContain("92,30");
    expect(t).not.toMatch(/[—–]/);
    expect(textoDaGuia(legal, "servico", { valor: 86.05, origem: "estimada" })).not.toContain("O app usa");
  });
});

describe("a guia no resumo da Empresa", () => {
  const paga = (valor: number, entryDate: string): LancamentoDaEmpresa => ({ id: "g", year: Number(entryDate.slice(0, 4)), month: Number(entryDate.slice(5, 7)), category: "EXPENSE", parentCategory: "IMPOSTOS", subcategory: "DAS (Simples Nacional)", description: "Guia do MEI", amount: valor, entryDate });
  const entrada = (config: unknown, lancamentos: LancamentoDaEmpresa[] = []) => ({ config: lerConfigEmpresa(config), hoje: "2026-10-15", mesAtual: { ano: 2026, mes: 10 }, dia: 15, diasNoMes: 31, lancamentos, legal, caixa: 0 });

  it("quem abriu antes (sem atividade) fica com serviço, R$ 86,05 estimado", () => {
    const r = resumoDaEmpresa(entrada({ tipo: "MEI" }));
    expect(r.guia).toMatchObject({ valor: 86.05, origem: "estimada" });
  });
  it("comércio estima R$ 82,05; o digitado vale no resumo e no custo do mês", () => {
    expect(resumoDaEmpresa(entrada({ tipo: "MEI", atividadeMei: "comercio" })).guia?.valor).toBe(82.05);
    const r = resumoDaEmpresa(entrada({ tipo: "MEI", atividadeMei: "comercio", dasDigitado: { valor: 83.5, em: "2026-10-15" } }));
    expect(r.guia).toMatchObject({ valor: 83.5, origem: "digitada" });
  });
  it("a guia paga depois do digitado volta a mandar", () => {
    const e = entrada({ tipo: "MEI", dasDigitado: { valor: 83.5, em: "2026-09-01" } }, [paga(86.05, "2026-09-18")]);
    expect(guiaDoMeiDaEmpresa(e)).toEqual({ valor: 86.05, origem: "paga" });
  });
  it("valor digitado inválido é ignorado na leitura", () => {
    expect(lerConfigEmpresa({ tipo: "MEI", dasDigitado: { valor: -3, em: "2026-10-15" } })?.dasDigitado).toBeNull();
    expect(lerConfigEmpresa({ tipo: "MEI", atividadeMei: "padaria" })?.atividadeMei).toBe("servico");
  });
});
