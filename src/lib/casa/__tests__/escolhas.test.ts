import { describe, expect, it } from "vitest";
import {
  divisaoVistaPeloOutro,
  escolhasDoLancamento,
  escolhasNoFormulario,
  escolhasParaOBanco,
  lerEscolhasDoFormulario,
  parteDeQuemLancou,
  resultadoDoGasto,
  rotuloDaDivisao,
  selosDoGasto,
  textoDoResultado,
  type DivisaoDaCasa,
  type Escolhas,
} from "@/lib/casa/escolhas";

/** As três perguntas do gasto no Casal simples (versão A do mockup, 15/10/2026), uma combinação por vez. */

const PELA_RENDA: DivisaoDaCasa = { modo: "renda", pctEuRenda: 55, semRenda: false, pctEuCombinado: 50 };
const E = (o: Partial<Escolhas>): Escolhas => ({ deQuem: "casa", pagouOPar: false, divide: "renda", parte: 50, ...o });
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

describe("o resultado na hora, como no mockup (Ana lança R$ 200, Lucas é o par, renda 55/45)", () => {
  const casos: [string, Partial<Escolhas>, string][] = [
    ["da casa, eu paguei, pela renda", {}, "Lucas fica devendo R$ 90 para você"],
    ["da casa, eu paguei, 50/50", { divide: "meio" }, "Lucas fica devendo R$ 100 para você"],
    ["da casa, eu paguei, outra 60%", { divide: "outra", parte: 60 }, "Lucas fica devendo R$ 80 para você"],
    ["da casa, Lucas pagou, pela renda", { pagouOPar: true }, "Você fica devendo R$ 110 para Lucas"],
    ["da casa, Lucas pagou, 50/50", { pagouOPar: true, divide: "meio" }, "Você fica devendo R$ 100 para Lucas"],
    ["da casa, Lucas pagou, outra 60%", { pagouOPar: true, divide: "outra", parte: 60 }, "Você fica devendo R$ 120 para Lucas"],
    ["meu, eu paguei", { deQuem: "meu" }, "Fica fora do acerto"],
    ["meu, Lucas pagou", { deQuem: "meu", pagouOPar: true }, "Você fica devendo R$ 200 para Lucas"],
    ["do Lucas, eu paguei", { deQuem: "par" }, "Lucas fica devendo R$ 200 para você"],
    ["do Lucas, Lucas pagou", { deQuem: "par", pagouOPar: true }, "Fica fora do acerto"],
    ["da casa, outra 100% minha, eu paguei", { divide: "outra", parte: 100 }, "Fica fora do acerto"],
  ];
  for (const [nome, e, texto] of casos) {
    it(nome, () => expect(textoDoResultado(resultadoDoGasto(200, E(e), PELA_RENDA), "Lucas", brl)).toBe(texto));
  }

  it("pela renda sem a renda dos dois cai para meio a meio; combinado usa a parte guardada", () => {
    expect(parteDeQuemLancou(E({}), { ...PELA_RENDA, semRenda: true })).toBe(50);
    expect(parteDeQuemLancou(E({ divide: "combinado" }), { ...PELA_RENDA, modo: "combinado", pctEuCombinado: 60 })).toBe(60);
  });
});

describe("no banco e no formulário", () => {
  it("a divisão igual à da casa vira nula (segue a casa); a diferente fica no gasto", () => {
    expect(escolhasParaOBanco(E({}), "renda")).toEqual({ doCasal: true, doPar: false, pagouOPar: false, divisaoPropria: null, parteDeQuemLancou: null });
    expect(escolhasParaOBanco(E({ divide: "meio", pagouOPar: true }), "renda")).toMatchObject({ divisaoPropria: "meio", pagouOPar: true });
    expect(escolhasParaOBanco(E({ divide: "outra", parte: 60.456 }), "meio")).toMatchObject({ divisaoPropria: "outra", parteDeQuemLancou: 60.46 });
    expect(escolhasParaOBanco(E({ divide: "combinado" }), "combinado").divisaoPropria).toBeNull();
    expect(escolhasParaOBanco(E({ deQuem: "par", divide: "outra" }), "renda")).toEqual({ doCasal: false, doPar: true, pagouOPar: false, divisaoPropria: null, parteDeQuemLancou: null });
  });

  it("o formulário vai e volta igual", () => {
    for (const e of [E({}), E({ deQuem: "par", pagouOPar: false }), E({ deQuem: "meu", pagouOPar: true }), E({ divide: "outra", parte: 60, pagouOPar: true })]) {
      expect(lerEscolhasDoFormulario(escolhasNoFormulario(e, "renda"))).toEqual(escolhasParaOBanco(e, "renda"));
    }
  });

  it("formulário sem as escolhas (fora da casa) ou com Outra vazia não vale", () => {
    expect(lerEscolhasDoFormulario({})).toBeNull();
    expect(lerEscolhasDoFormulario({ casaDeQuem: "casa", casaDivisao: "outra", casaParte: "" })).toBeNull();
    expect(lerEscolhasDoFormulario({ casaDeQuem: "casa", casaDivisao: "outra", casaParte: "250" })?.parteDeQuemLancou).toBe(100);
  });

  it("o lançamento salvo abre com as escolhas dele", () => {
    expect(escolhasDoLancamento({ doPar: false, pagouOPar: true, divisaoPropria: "outra", parteDeQuemLancou: 60 }, true, PELA_RENDA)).toEqual(E({ pagouOPar: true, divide: "outra", parte: 60 }));
    expect(escolhasDoLancamento({ doPar: true, pagouOPar: false, divisaoPropria: null, parteDeQuemLancou: null }, false, PELA_RENDA).deQuem).toBe("par");
    expect(escolhasDoLancamento({}, false, PELA_RENDA)).toEqual(E({ deQuem: "meu", parte: 55 }));
  });
});

describe("os selinhos", () => {
  const nomes = { quemLancou: "Ana", outro: "Lucas", deQuemOlha: "quemLancou" as const };
  it("como no mockup: Da casa, Ana pagou, 55/45", () => {
    expect(selosDoGasto(E({}), PELA_RENDA, nomes)).toEqual(["Da casa", "Ana pagou", "55/45"]);
    expect(selosDoGasto(E({ pagouOPar: true, divide: "outra", parte: 60 }), PELA_RENDA, nomes)).toEqual(["Da casa", "Lucas pagou", "60/40"]);
  });
  it("visto pelo Lucas, a parte dele vem primeiro", () => {
    expect(selosDoGasto(E({ divide: "outra", parte: 60 }), PELA_RENDA, { ...nomes, deQuemOlha: "outro" })).toEqual(["Da casa", "Ana pagou", "40/60"]);
    expect(divisaoVistaPeloOutro(PELA_RENDA).pctEuRenda).toBe(45);
  });
  it("de um só: só quando entra no acerto", () => {
    expect(selosDoGasto(E({ deQuem: "par" }), PELA_RENDA, nomes)).toEqual(["De Lucas", "Ana pagou"]);
    expect(selosDoGasto(E({ deQuem: "meu", pagouOPar: true }), PELA_RENDA, nomes)).toEqual(["De Ana", "Lucas pagou"]);
    expect(selosDoGasto(E({ deQuem: "meu" }), PELA_RENDA, nomes)).toEqual([]);
    expect(rotuloDaDivisao(54.6)).toBe("55/45");
  });
});
