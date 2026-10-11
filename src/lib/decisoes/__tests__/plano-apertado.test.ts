import { describe, expect, it } from "vitest";
import { avaliarCompra, LIMIAR_PLANO_APERTADO, planoApertado, type CompraBase } from "../posso-comprar";

const fmt = { money: (v: number) => `R$ ${Math.round(v)}`, mesDaqui: (m: number | null) => (m === null ? "sem previsão" : `${m} meses`) };

/** A Ana canônica: renda 7.700, plano de gastos 7.300, 25 dias até o fim do mês. */
const ana: CompraBase = {
  renda: 7700,
  gastoPlanejado: 7300,
  sobraDoMes: 3241,
  diasRestantes: 25,
  diasAteDomingo: 5,
  metas: [],
  taxaReferencia: 0.008,
};

describe("plano apertado (regra 3.8)", () => {
  it("o limiar é 90%", () => {
    expect(LIMIAR_PLANO_APERTADO).toBe(0.9);
  });

  it("Ana: 7.300 de 7.700 é 94,8%, mostrado como 95%", () => {
    const p = planoApertado(ana)!;
    expect(p.fracao).toBeCloseTo(0.948, 3);
    expect(p.pct).toBe("95%");
    expect(p.texto).toBe("Seu plano está apertado: 95% da renda já tem destino.");
    expect(p.atalho).toEqual({ rotulo: "Ver onde abrir espaço", href: "/orcamento" });
  });

  it("com 85% o aviso some; exatamente 90% já é apertado", () => {
    expect(planoApertado({ renda: 10000, gastoPlanejado: 8500 })).toBeNull();
    expect(planoApertado({ renda: 10000, gastoPlanejado: 9000 })?.pct).toBe("90,0%");
    // Perto dos 90, uma casa decimal e para longe do limite: 89,96% nunca aparece "90%".
    expect(planoApertado({ renda: 10000, gastoPlanejado: 8996 })).toBeNull();
    expect(planoApertado({ renda: 10000, gastoPlanejado: 9004 })?.pct).toBe("90,1%");
  });

  it("assinaturas pesando mais: o atalho vai para o Raio-X", () => {
    expect(planoApertado(ana, { assinaturasPesamMais: true })?.atalho.href).toBe("/decidir/raio-x");
  });

  it("não vale no Casal com conta conjunta, nem sem renda ou sem plano", () => {
    expect(planoApertado({ ...ana, regra90: false })).toBeNull();
    expect(planoApertado({ ...ana, renda: 0 })).toBeNull();
    expect(planoApertado({ ...ana, gastoPlanejado: 0 })).toBeNull();
  });

  it("o 'Posso comprar?' traz o aviso junto da resposta, qualquer que seja ela", () => {
    const vista = avaliarCompra(ana, { valor: 50, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    const parcelado = avaliarCompra(ana, { valor: 600, modo: "parcelado", parcelas: 6, juros: 0, desconto: 0 }, fmt);
    for (const r of [vista, parcelado]) {
      expect("erro" in r).toBe(false);
      if (!("erro" in r)) expect(r.planoApertado?.pct).toBe("95%");
    }
    const folgada = avaliarCompra({ ...ana, gastoPlanejado: 6500 }, { valor: 50, modo: "vista", parcelas: 1, juros: 0, desconto: 0 }, fmt);
    if (!("erro" in folgada)) expect(folgada.planoApertado).toBeNull();
  });
});
