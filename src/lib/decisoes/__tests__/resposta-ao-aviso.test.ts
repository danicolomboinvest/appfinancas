import { describe, expect, it } from "vitest";
import { avisoRespondido, respostaSeguraOAviso, respostasDeEstouro } from "../resposta-ao-aviso";
import { montarFoco, type FocoEntrada } from "../foco";
import { vozDoTema } from "@/lib/profiles/voice";

const base = (over: Partial<FocoEntrada> = {}): FocoEntrada => ({
  ritmo: "semanal",
  dia: 14,
  diasNoMes: 31,
  categorias: [
    { key: "SAUDE", label: "Saúde", planejado: 350, gasto: 503 },
    { key: "LAZER", label: "Lazer", planejado: 400, gasto: 480 },
    { key: "ALIMENTACAO", label: "Alimentação", planejado: 1500, gasto: 700 },
  ],
  gastoDoMes: 1683,
  aportadoNoMes: 0,
  aportePlanejado: null,
  diasDesdeUltimoGasto: 1,
  metas: [],
  reserva: null,
  hrefMes: "/mensal/2026/10",
  money: (v) => `R$ ${Math.round(v)}`,
  t: vozDoTema("padrao").titulos,
  ...over,
});
const ids = (f: ReturnType<typeof montarFoco>) => [...f.atencao, ...f.depois].map((i) => i.id);

describe("respostaSeguraOAviso", () => {
  it("segura enquanto não passar 50% a mais e pelo menos R$ 50 a mais", () => {
    expect(respostaSeguraOAviso(153, 153)).toBe(true);
    expect(respostaSeguraOAviso(153, 229)).toBe(true);
    expect(respostaSeguraOAviso(153, 230)).toBe(false);
    // R$ 20 que viram R$ 40 é o dobro, mas não chega a R$ 50 a mais.
    expect(respostaSeguraOAviso(20, 40)).toBe(true);
    expect(respostaSeguraOAviso(20, 70)).toBe(false);
  });

  it("resposta sem valor (antiga, ou não gastar mais nada) segura o mês todo", () => {
    expect(respostaSeguraOAviso(null, 10_000)).toBe(true);
    expect(respostaSeguraOAviso(undefined, 10_000)).toBe(true);
  });
});

describe("respostasDeEstouro", () => {
  it("lê só os avisos de categoria que passou, e o teto zero vale o mês todo", () => {
    const r = respostasDeEstouro(
      [
        { id: "estouro-SAUDE", passou: 153 },
        { id: "aporte", passou: null },
        { id: "estouro-ck1abc", passou: 40 },
      ],
      [
        { categoria: "LAZER", valor: 0 },
        { categoria: "ALIMENTACAO", valor: 200 },
      ],
    );
    expect([...r.entries()]).toEqual([
      ["SAUDE", 153],
      ["ck1abc", 40],
      ["LAZER", null],
    ]);
    expect(avisoRespondido(r, "SAUDE", 160)).toBe(true);
    expect(avisoRespondido(r, "SAUDE", 300)).toBe(false);
    expect(avisoRespondido(r, "LAZER", 9_999)).toBe(true);
    expect(avisoRespondido(r, "ALIMENTACAO", 10)).toBe(false);
  });
});

describe("o aviso some depois de cada resposta (Foco, Decidir, Resumo)", () => {
  it("sem resposta, Saúde e Lazer avisam; a que mais passou primeiro", () => {
    const f = montarFoco(base());
    expect(f.atencao[0].id).toBe("estouro-SAUDE");
    expect(ids(f)).toContain("estouro-LAZER");
  });

  it("foi pontual: Saúde sai e o aviso passa para Lazer", () => {
    const f = montarFoco(base({ dispensados: [{ id: "estouro-SAUDE", passou: 153 }] }));
    expect(ids(f)).not.toContain("estouro-SAUDE");
    expect(f.atencao[0].id).toBe("estouro-LAZER");
  });

  it("cobrir com outra categoria: o plano sobe, e com a resposta guardada o aviso não volta por centavos", () => {
    const f = montarFoco(
      base({
        categorias: [
          { key: "SAUDE", label: "Saúde", planejado: 503, gasto: 530 },
          { key: "ALIMENTACAO", label: "Alimentação", planejado: 1347, gasto: 700 },
        ],
        dispensados: [{ id: "estouro-SAUDE", passou: 153 }],
      }),
    );
    expect(ids(f)).not.toContain("estouro-SAUDE");
  });

  it("subir o plano ou segurar até o fim do mês (teto zero) também tira", () => {
    expect(ids(montarFoco(base({ dispensados: [{ id: "estouro-SAUDE", passou: 153 }], categorias: [{ key: "SAUDE", label: "Saúde", planejado: 400, gasto: 503 }] })))).not.toContain("estouro-SAUDE");
    expect(ids(montarFoco(base({ tetos: [{ categoria: "SAUDE", valor: 0 }] })))).not.toContain("estouro-SAUDE");
  });

  it("volta só se passar bem mais do que na hora da resposta", () => {
    const pouco = montarFoco(base({ dispensados: [{ id: "estouro-SAUDE", passou: 153 }], categorias: [{ key: "SAUDE", label: "Saúde", planejado: 350, gasto: 560 }] }));
    expect(ids(pouco)).not.toContain("estouro-SAUDE");
    const muito = montarFoco(base({ dispensados: [{ id: "estouro-SAUDE", passou: 153 }], categorias: [{ key: "SAUDE", label: "Saúde", planejado: 350, gasto: 600 }] }));
    expect(ids(muito)).toContain("estouro-SAUDE");
  });

  it("dispensa antiga, só com o id, segue segurando", () => {
    const f = montarFoco(base({ dispensados: ["estouro-SAUDE"], categorias: [{ key: "SAUDE", label: "Saúde", planejado: 350, gasto: 2000 }] }));
    expect(ids(f)).not.toContain("estouro-SAUDE");
  });
});
