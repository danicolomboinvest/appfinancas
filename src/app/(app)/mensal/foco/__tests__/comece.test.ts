import { describe, expect, it } from "vitest";
import { ORDEM_DO_COMECE, mostrarComece, passosDoComece, perguntarRitmo } from "../comece";
import { vozDoTema } from "@/lib/profiles/voice";
import { PROFILE_THEMES } from "@/lib/profiles/themes";
import { SECOES_DO_MANUAL } from "@/lib/manual/conteudo";

const AGORA = new Date("2026-09-30T15:00:00Z");
const base = { temLancamento: false, temOrcamento: false, viuMes: false, primeiroLancamentoEm: null, agora: AGORA };

describe("Comece por aqui: um passo por vez, sempre na mesma ordem", () => {
  it("a ordem é importar, ver o mês, orçamento", () => {
    expect(ORDEM_DO_COMECE).toEqual(["importar", "verMes", "orcamento"]);
  });

  it("conta nova: o passo da vez é subir o extrato, e o guia não some", () => {
    const p = passosDoComece(base);
    expect(p.contaNova).toBe(true);
    expect(p.atual).toBe("importar");
    expect(p.feitos).toBe(0);
    // Mesmo dispensado em outro momento: pra conta nova o cartão é o Foco inteiro.
    expect(mostrarComece(p, true)).toBe(true);
  });

  it("orçamento feito antes (a ordem antiga do manual) não pula a importação", () => {
    const p = passosDoComece({ ...base, temOrcamento: true });
    expect(p.atual).toBe("importar");
    expect(p.feitos).toBe(1);
    // Sem lançamento não há mês pra ver: o passo 2 não conta como feito.
    expect(p.passos.find((x) => x.id === "verMes")?.feito).toBe(false);
  });

  it("depois do primeiro lançamento, o passo da vez é ver o mês montado", () => {
    const p = passosDoComece({ ...base, temLancamento: true, primeiroLancamentoEm: new Date("2026-09-30T14:00:00Z") });
    expect(p.contaNova).toBe(false);
    expect(p.atual).toBe("verMes");
  });

  it("viu o mês: o passo da vez é o orçamento", () => {
    const p = passosDoComece({ ...base, temLancamento: true, viuMes: true, primeiroLancamentoEm: new Date("2026-09-30T14:00:00Z") });
    expect(p.atual).toBe("orcamento");
    expect(p.feitos).toBe(2);
  });

  it("quem usa o app há dias não recebe 'veja seu mês' como novidade", () => {
    const p = passosDoComece({ ...base, temLancamento: true, primeiroLancamentoEm: new Date("2026-09-20T12:00:00Z") });
    expect(p.atual).toBe("orcamento");
  });

  it("dá pra terminar: com lançamento e orçamento, os três estão feitos e o guia some", () => {
    const p = passosDoComece({ ...base, temLancamento: true, temOrcamento: true, primeiroLancamentoEm: new Date("2026-09-30T14:00:00Z") });
    expect(p.atual).toBeNull();
    expect(p.feitos).toBe(3);
    expect(mostrarComece(p, false)).toBe(false);
  });

  it("sem passo de carteira: são só três, e nenhum depende de investir", () => {
    const p = passosDoComece(base);
    expect(p.passos.map((x) => x.id)).toEqual(["importar", "verMes", "orcamento"]);
  });

  it("depois do primeiro lançamento, o X esconde o guia", () => {
    const p = passosDoComece({ ...base, temLancamento: true, primeiroLancamentoEm: AGORA });
    expect(mostrarComece(p, false)).toBe(true);
    expect(mostrarComece(p, true)).toBe(false);
  });
});

describe("pergunta de ritmo (semanal ou mensal)", () => {
  it("só depois do primeiro lançamento, e só se ainda não escolheu", () => {
    expect(perguntarRitmo(false, false)).toBe(false);
    expect(perguntarRitmo(false, true)).toBe(true);
    expect(perguntarRitmo(true, true)).toBe(false);
  });
});

describe("textos do Comece por aqui e do tour", () => {
  const jargao = /aport|provento|patrim[oô]nio|rentabilidade|ac[uú]mulo|consolidado|proje[cç][aã]o/i;
  const textos = (t: ReturnType<typeof vozDoTema>["titulos"]) => [
    t.focoComeceTitulo,
    t.focoComeceContagem(1, 3),
    t.focoComeceImportarT,
    t.focoComeceImportarP,
    t.focoComeceImportarBotao,
    t.focoComeceDigitar,
    t.focoComeceAjuda,
    t.focoComeceMesT,
    t.focoComeceMesP,
    t.focoComeceMesBotao,
    t.focoComeceOrcamentoT,
    t.focoComeceOrcamentoP,
    t.focoComeceOrcamentoBotao,
    t.focoComeceDispensar,
    t.focoComeceManual,
    t.focoTourMaisTexto("pessoa"),
    t.focoTourMaisTexto("casal"),
    t.focoTourMaisTexto("empresa"),
    t.focoTourFimTexto,
  ];

  it("todo tema, pessoa ou empresa, tem os textos, sem jargão e sem falar de carteira ou IR", () => {
    for (const tema of PROFILE_THEMES) {
      for (const kind of ["PESSOAL", "CASAL", "EMPRESA"]) {
        for (const texto of textos(vozDoTema(tema.key, kind).titulos)) {
          expect(texto, `${tema.key}/${kind}`).toBeTruthy();
          expect(texto, `${tema.key}/${kind}`).not.toMatch(jargao);
          expect(texto, `${tema.key}/${kind}`).not.toMatch(/imposto de renda|preço médio|carteira/i);
        }
      }
    }
  });

  it("o Girly tem a versão dela, com emoji", () => {
    const g = vozDoTema("girly").titulos;
    const p = vozDoTema("padrao").titulos;
    expect(g.focoComeceImportarT).not.toBe(p.focoComeceImportarT);
    expect(g.focoComeceTitulo).toMatch(/\p{Extended_Pictographic}/u);
    expect(g.focoTourFimTexto).toMatch(/\p{Extended_Pictographic}/u);
  });

  it("o menu Mais cita o que existe em cada perfil", () => {
    const p = vozDoTema("padrao").titulos;
    expect(p.focoTourMaisTexto("pessoa")).toContain("Decidir");
    expect(p.focoTourMaisTexto("pessoa")).not.toContain("Quanto cada um contribui");
    expect(p.focoTourMaisTexto("casal")).toContain("Quanto cada um contribui");
    // A Empresa não tem Decidir nem viagem.
    expect(p.focoTourMaisTexto("empresa")).not.toMatch(/Decidir|Viagem/);
    expect(p.focoTourMaisTexto("empresa")).toContain("Vale a pena investir?");
  });
});

describe("manual: o Comece por aqui segue a mesma ordem", () => {
  it("trazer os gastos vem antes do orçamento", () => {
    const comecar = SECOES_DO_MANUAL.find((s) => s.id === "comecar");
    const passos = comecar?.blocos.find((b) => b.tipo === "passos");
    if (!passos || passos.tipo !== "passos") throw new Error("seção Comece por aqui sem passos");
    const titulos = passos.itens.map((i) => i.titulo);
    const gastos = titulos.findIndex((x) => /gastos/i.test(x));
    const orcamento = titulos.findIndex((x) => x.includes("{orcamento}"));
    expect(gastos).toBe(0);
    expect(orcamento).toBeGreaterThan(gastos);
  });
});
