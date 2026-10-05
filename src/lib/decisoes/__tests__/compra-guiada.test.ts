import { describe, expect, it } from "vitest";
import { avaliarCompra, type CompraBase } from "../posso-comprar";
import {
  CATEGORIAS_DA_COMPRA,
  caminhosParaCaber,
  categoriaOutra,
  formaQuePesaMenos,
  ordemDasDecisoes,
  parcelaDaDescricao,
  parcelasPorMes,
  podeSugerirParcela,
  TAXAS_DA_ROLETA,
  VALORES_DA_ROLETA,
  VEZES_DA_ROLETA,
  vereditoComPeso,
} from "../compra-guiada";

const fmt = { money: (v: number) => `R$ ${Math.round(v)}`, mesDaqui: (m: number | null) => (m === null ? "sem previsão" : `+${m}`) };
const cat = (id: string) => CATEGORIAS_DA_COMPRA.find((c) => c.id === id)!;
// O mês do protótipo: renda R$ 6.300, R$ 729 guardados por mês pra viagem, pouca folga.
const base: CompraBase = {
  renda: 6300,
  gastoPlanejado: 5380,
  sobraDoMes: 900,
  diasRestantes: 20,
  taxaReferencia: 0.009,
  guardarPlanejado: 729,
  metas: [{ id: "bcn", nome: "Barcelona", atual: 2000, alvo: 7800, aporte: 729, taxa: 0, prazoMeses: 9 }],
  categorias: [
    { chave: "LAZER", nome: "Lazer", planejado: 600, gasto: 100 },
    { chave: "ALIMENTACAO", nome: "Alimentação", planejado: 1500, gasto: 600 },
  ],
};

describe("roletas", () => {
  it("valor começa no zero, vai de 1 em 1 até 200 e chega a 1 milhão", () => {
    expect(VALORES_DA_ROLETA[0]).toBe(0);
    expect(VALORES_DA_ROLETA.slice(0, 4)).toEqual([0, 1, 2, 3]);
    expect(VALORES_DA_ROLETA).toContain(3000);
    expect(VALORES_DA_ROLETA.at(-1)).toBe(1_000_000);
    expect(new Set(VALORES_DA_ROLETA).size).toBe(VALORES_DA_ROLETA.length);
  });
  it("vezes de 2 a 48 de um em um, depois financiamento até 420", () => {
    expect(VEZES_DA_ROLETA.slice(0, 3)).toEqual([2, 3, 4]);
    expect(VEZES_DA_ROLETA).toContain(48);
    expect(VEZES_DA_ROLETA).toContain(360);
    expect(VEZES_DA_ROLETA.at(-1)).toBe(420);
  });
  it("juros de 0,5% a 15%", () => {
    expect(TAXAS_DA_ROLETA[0]).toBe(0.5);
    expect(TAXAS_DA_ROLETA).toContain(3);
    expect(TAXAS_DA_ROLETA.at(-1)).toBe(15);
  });
});

describe("peso do Seja sincera", () => {
  it("precisa: vermelho vira amarelo só se dá pra pagar sem mexer no básico", () => {
    expect(vereditoComPeso("nao", "precisa", 3000, true)).toBe("custo");
    expect(vereditoComPeso("nao", "precisa", 3000, false)).toBe("nao");
    expect(vereditoComPeso("ok", "precisa", 3000, true)).toBe("ok");
  });
  it("impulso: um nível mais duro acima de R$ 100", () => {
    expect(vereditoComPeso("ok", "impulso", 150, true)).toBe("custo");
    expect(vereditoComPeso("custo", "impulso", 3000, true)).toBe("nao");
    expect(vereditoComPeso("ok", "impulso", 80, true)).toBe("ok");
  });
  it("quero: a conta como ela é", () => {
    expect(vereditoComPeso("custo", "quero", 3000, true)).toBe("custo");
  });
});

describe("regra da parcela", () => {
  it("roupa, beleza, viagem e outra coisa nunca recebem sugestão de parcela", () => {
    for (const id of ["vestuario", "beleza", "viagem"]) expect(podeSugerirParcela(cat(id), 0, 100, 6300)).toBe(false);
    expect(podeSugerirParcela(categoriaOutra("bolsa"), 0, 100, 6300)).toBe(false);
  });
  it("bem durável: só se as parcelas do mês somadas ficam em até 15% da renda", () => {
    expect(podeSugerirParcela(cat("celular"), 380, 300, 6300)).toBe(true); // 680 ≤ 945
    expect(podeSugerirParcela(cat("celular"), 800, 300, 6300)).toBe(false); // 1.100 > 945
  });
});

describe("parcelas que já existem", () => {
  it("lê a parcela que o banco escreve", () => {
    expect(parcelaDaDescricao("LOJA PARCELADA 09/10")).toEqual({ atual: 9, total: 10 });
    expect(parcelaDaDescricao("Anuidade Diferenciada - Parcela 1/12")).toEqual({ atual: 1, total: 12 });
    expect(parcelaDaDescricao("LOJA EXEMPLO 03/09 PARCELA 02/10")).toEqual({ atual: 2, total: 10 });
    expect(parcelaDaDescricao("PAYGO*LGSTAR A 03/04")).toEqual({ atual: 3, total: 4 });
  });
  it("data não é parcela", () => {
    expect(parcelaDaDescricao("PIX ENVIADO 18/09/2026-23:16:31 PADARIA")).toBeNull();
    expect(parcelaDaDescricao("DES: PADARIA 27/08")).toBeNull();
    expect(parcelaDaDescricao("MERCADO")).toBeNull();
  });
  it("do mês passado só contam as que continuam", () => {
    const mes = [{ descricao: "MERCADO", valor: 200 }];
    const passado = [
      { descricao: "LOJA 03/10", valor: 300 },
      { descricao: "OUTRA 10/10", valor: 80 },
    ];
    expect(parcelasPorMes(mes, passado)).toBe(300);
    expect(parcelasPorMes([{ descricao: "LOJA 04/10", valor: 300 }, { descricao: "TV 01/12", valor: 150 }], passado)).toBe(450);
  });
});

describe("quero que você decida", () => {
  it("roupa que não cabe à vista continua à vista (nunca parcelinha)", () => {
    expect(formaQuePesaMenos(base, 3000, cat("vestuario"), 0, fmt).modo).toBe("vista");
  });
  it("celular: menor número de vezes sem juros que cabe", () => {
    const f = formaQuePesaMenos(base, 1500, cat("celular"), 0, fmt);
    expect(f.modo).toBe("parcelado");
    expect(f.juros).toBe(0);
    const r = avaliarCompra(base, { valor: 1500, ...f, desconto: 0 }, fmt);
    if ("erro" in r) throw new Error();
    expect(r.veredito).toBe("ok");
  });
});

describe("caminhos pra fazer caber", () => {
  const roupa = { valor: 3000, modo: "parcelado" as const, parcelas: 10, juros: 0, desconto: 0 };
  it("roupa parcelada: nenhum caminho é parcela; tem juntar", () => {
    const c = caminhosParaCaber(base, roupa, cat("vestuario"), "quero", 380, fmt);
    expect(c.some((x) => x.chave === "parcelar")).toBe(false);
    expect(c.some((x) => x.chave === "cortar")).toBe(false);
    expect(c.some((x) => x.tipo === "juntar")).toBe(true);
    const barato = c.find((x) => x.chave === "barato");
    if (barato?.chave === "barato") expect(barato.compra.modo).toBe("vista");
  });
  it("todo caminho de comprar cabe de verdade na conta", () => {
    for (const [id, s] of [["celular", "quero"], ["vestuario", "precisa"], ["eletronico", "precisa"]] as const) {
      for (const c of caminhosParaCaber(base, { ...roupa, valor: 4000 }, cat(id), s, 0, fmt)) {
        if (c.tipo !== "comprar" || c.chave === "desconto" || c.chave === "cortar") continue;
        const r = avaliarCompra(base, c.compra, fmt);
        if ("erro" in r) throw new Error();
        expect(r.veredito).toBe("ok");
      }
    }
  });
  it("precisa e com juros: oferece desconto à vista", () => {
    const c = caminhosParaCaber(base, { ...roupa, juros: 0.03 }, cat("eletronico"), "precisa", 0, fmt);
    expect(c.some((x) => x.chave === "desconto")).toBe(true);
  });
});

describe("ordem das decisões", () => {
  it("escolheu juntar: guardar primeiro e comprar sai", () => {
    const o = ordemDasDecisoes("precisa", null, { tipo: "juntar" });
    expect(o[0]).toBe("guardar");
    expect(o).not.toContain("comprar");
  });
  it("escolheu um jeito de comprar: comprar primeiro e guardar sai", () => {
    const o = ordemDasDecisoes("quero", null, { tipo: "comprar" });
    expect(o[0]).toBe("comprar");
    expect(o).not.toContain("guardar");
  });
  it("sem caminho: pelo Seja sincera", () => {
    expect(ordemDasDecisoes("precisa", null, null)).toEqual(["comprar", "guardar", "amanha"]);
    expect(ordemDasDecisoes("impulso", null, null)[0]).toBe("amanha");
    expect(ordemDasDecisoes("quero", "sonho", null)[0]).toBe("guardar");
    expect(ordemDasDecisoes("quero", "compra", null)[0]).toBe("comprar");
  });
});
