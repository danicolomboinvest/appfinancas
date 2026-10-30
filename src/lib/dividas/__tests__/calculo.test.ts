import { describe, expect, it } from "vitest";
import { EXTRA_INICIAL, textoDoCalculo, ATALHOS_DO_EXTRA } from "../calculo";
import { simularQuitacao, ehImpossivel } from "../plano";
import type { DividaDoSpi } from "../saude";

const m0 = (v: number) => `R$ ${v}`;
const base = { apelido: "", paraQue: null, planejada: false, parcelasAbertas: null, parcelasTotal: null, semParcela: false, diaVencimento: null, atrasada: false };

describe("plano de dívidas: o valor a mais começa em zero", () => {
  it("ninguém disse que tem dinheiro sobrando: começa sem nada a mais", () => {
    expect(EXTRA_INICIAL).toBe(0);
  });
  it("com zero, a linha diz que só contou as parcelas de hoje", () => {
    expect(textoDoCalculo(0, m0)).toBe("só com as parcelas de hoje");
  });
  it("com valor, a linha diz quanto a mais por mês", () => {
    expect(textoDoCalculo(200, m0)).toBe("com R$ 200 a mais por mês");
  });
  it("os atalhos são 100, 200 e 500, nenhum é zero", () => {
    expect(ATALHOS_DO_EXTRA).toEqual([100, 200, 500]);
  });
  it("com zero o plano ainda dá data para dívida com parcela", () => {
    const d: DividaDoSpi = { ...base, id: "a", tipo: "emprestimo", credor: "Banco", nome: "Banco", saldo: 3000, porMes: 1000, taxaMensal: 0 };
    const p = simularQuitacao([d], EXTRA_INICIAL);
    expect(ehImpossivel(p)).toBe(false);
    expect(!ehImpossivel(p) && p.meses).toBe(3);
  });
});
