import { describe, expect, it } from "vitest";
import { ateAgora, contraOPreco, escolhasDaCarta, mensagemDeEstorno, porqueDaCarta, rotuloDaCarta, subDaCarta, valorDoSim } from "../placar";
import type { Achado } from "../detectar";

const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const base: Achado = {
  chave: "x",
  tipo: "repetida",
  nome: "iFood, 2 vezes",
  quem: "iFood",
  descricaoDoLogo: "IFOOD",
  mensal: null,
  unico: 58.4,
  anual: 58.4,
  dia: null,
  meses: 1,
  datas: ["2026-09-12", "2026-09-13"],
  valorDaCobranca: 58.4,
  comerciante: "m:ifood",
  ultimaData: "2026-09-13",
  lancamentos: [],
};

describe("Até agora", () => {
  it("soma o 'não uso' pelo mês e o estorno que voltou de uma vez; pedido sem resposta não soma", () => {
    const r = ateAgora([
      { mensal: 43.9, unico: null, estado: "nao_uso" },
      { mensal: 9.9, unico: null, estado: "nao_uso" },
      { mensal: null, unico: 58.4, estado: "estornado" },
      { mensal: null, unico: 30, estado: "pedi_estorno" },
      { mensal: 21.9, unico: null, estado: "uso" },
      { mensal: 19.9, unico: null, estado: "aberto" },
    ]);
    expect(r.porMes).toBe(53.8);
    expect(r.deUmaVez).toBe(58.4);
    expect(r.porAno).toBe(704);
    expect(r.quantos).toBe(3);
  });

  it("contra o preço do SPI: falta, pagou e quantas vezes", () => {
    expect(contraOPreco(40, 97)).toEqual({ pagou: false, vezes: 0, falta: 57 });
    expect(contraOPreco(97, 97).pagou).toBe(true);
    expect(contraOPreco(704, 97)).toEqual({ pagou: true, vezes: 7, falta: 0 });
  });
});

describe("cartas", () => {
  it("cada tipo tem os seus dois botões", () => {
    expect(escolhasDaCarta({ ...base, tipo: "assinatura", mensal: 10 }).sim).toBe("Não uso");
    expect(escolhasDaCarta(base)).toMatchObject({ sim: "Pedir estorno", nao: "Foram 2 pedidos", abreEstorno: true });
    expect(escolhasDaCarta({ ...base, tipo: "aumento", mensal: 15 }).nao).toBe("Tudo bem");
    expect(escolhasDaCarta({ ...base, tipo: "tarifa", tarifa: "seguro", mensal: 9.9 }).sim).toBe("Não lembro");
  });

  it("o porquê diz vale conferir, nunca indevida", () => {
    const t = porqueDaCarta(base, money);
    expect(t).toContain("Vale conferir");
    expect(t.toLowerCase()).not.toContain("indevid");
    expect(subDaCarta(base, money)).toBe("uma vez, 12/09 e 13/09");
  });

  it("a mensagem de estorno é pronta, educada e sem travessão", () => {
    const tipos: Partial<Achado>[] = [
      base,
      { tipo: "tarifa", tarifa: "pacote", mensal: 64.9, unico: null },
      { tipo: "tarifa", tarifa: "seguro", mensal: 9.9, unico: null },
      { tipo: "tarifa", tarifa: "anuidade", mensal: 32, unico: null },
    ];
    for (const t of tipos) {
      const m = mensagemDeEstorno({ ...base, ...t }, money);
      expect(m.startsWith("Olá, tudo bem?")).toBe(true);
      expect(m).not.toMatch(/[—–]/);
      expect(m.toLowerCase()).not.toContain("indevid");
    }
    expect(mensagemDeEstorno(base, money)).toContain("nos dias 12/09 e 13/09");
  });

  it("IOF e juros não são tarifa: nome certo, sem estorno, nada para recuperar", () => {
    const iof = { ...base, tipo: "tarifa" as const, tarifa: "iof" as const, nome: "IOF", mensal: null, unico: 6.48, datas: ["2026-09-10"] };
    const juros = { ...base, tipo: "tarifa" as const, tarifa: "juros" as const, nome: "Juros e multa", mensal: null, unico: 42.1, datas: ["2026-09-15"] };
    expect(rotuloDaCarta(iof)).toBe("IOF");
    expect(rotuloDaCarta(juros)).toBe("Juros e multa");
    expect(rotuloDaCarta({ tipo: "tarifa", tarifa: "pacote" })).toBe("Tarifa escondida");
    expect(porqueDaCarta(iof, money)).toContain("imposto");
    expect(porqueDaCarta(iof, money)).toContain("Não tem estorno");
    expect(porqueDaCarta(juros, money)).toContain("Pagar em dia");
    for (const c of [iof, juros]) {
      expect(porqueDaCarta(c, money).toLowerCase()).not.toContain("tarifa");
      const e = escolhasDaCarta(c);
      expect(e).toMatchObject({ sim: "Vou evitar", nao: "Tudo bem", abreEstorno: false });
      expect(e.estadoSim).not.toBe("pedi_estorno");
      expect(valorDoSim(c)).toBe(0);
      // "Vou evitar" não vira dinheiro recuperado, nem quando se repete todo mês.
      expect(ateAgora([{ mensal: 12, unico: null, estado: e.estadoSim }]).porAno).toBe(0);
    }
  });
});
