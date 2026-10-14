import { describe, expect, it } from "vitest";
import { alternarParte, caminhoDoMotivo, casalParaRecomecar, comDependencias, comecoParaRecomecar, confirmacaoValida, conexoesDosPerfis, ehEscopoDaLimpeza, lerPartes, ehRespostaDoMotivo, MOTIVOS_DA_LIMPEZA, PARTES, temSaidaMenor, voltaAoComeco } from "../regras";

describe("confirmação digitada", () => {
  it("aceita LIMPAR com qualquer caixa e espaço nas pontas", () => {
    for (const v of ["LIMPAR", "limpar", " Limpar "]) expect(confirmacaoValida(v), v).toBe(true);
  });
  it("recusa o resto", () => {
    for (const v of ["", "LIMPA", "LIMPAR TUDO", "apagar", null, undefined, 1]) expect(confirmacaoValida(v), String(v)).toBe(false);
  });
});

describe("escopo", () => {
  it("só perfil ou todos", () => {
    expect(ehEscopoDaLimpeza("perfil")).toBe(true);
    expect(ehEscopoDaLimpeza("todos")).toBe(true);
    expect(ehEscopoDaLimpeza("conta")).toBe(false);
    expect(ehEscopoDaLimpeza(undefined)).toBe(false);
  });
});

describe("começo depois de limpar", () => {
  it("abre na porta do primeiro lançamento e guarda só o apelido e o que ela quer", () => {
    const c = comecoParaRecomecar({ passo: "porta", apelido: "Aninha", renda: 5000, quer: "dividas", lancou: "extrato", terminouEm: "2026-09-01", aha: true, bancos: ["nubank"] });
    expect(c).toMatchObject({ passo: "porta", apelido: "Aninha", quer: "dividas", renda: null, lancou: null, terminouEm: null, aha: false, bancos: [] });
  });
  it("quem nunca passou pelo começo novo também cai na porta", () => {
    expect(comecoParaRecomecar(null)).toMatchObject({ passo: "porta", apelido: null, quer: null });
  });
});

describe("combinado do casal depois de limpar", () => {
  it("tira só os meses acertados", () => {
    expect(casalParaRecomecar({ nomeA: "Ana", nomeB: "Léo", divisao: "renda", acertos: ["2026-08", "2026-09"], regras: { aluguel: "meio" } })).toEqual({
      nomeA: "Ana",
      nomeB: "Léo",
      divisao: "renda",
      acertos: [],
      regras: { aluguel: "meio" },
    });
  });
});

describe("bancos conectados do perfil", () => {
  const conexoes = [
    { id: "nu", connectorName: "Nubank" },
    { id: "itau", connectorName: "Itaú" },
    { id: "inter", connectorName: "Inter" },
    { id: "misto", connectorName: "C6" },
  ];
  const lotes = [
    { profileId: "pes", fileName: "Nubank · 01/10/2026" },
    { profileId: "pes", fileName: "Nubank · 02/10/2026" },
    { profileId: "emp", fileName: "Itaú · 01/10/2026" },
    { profileId: "pes", fileName: "C6 · 01/10/2026" },
    { profileId: "emp", fileName: "C6 · 05/10/2026" },
    { profileId: "pes", fileName: "Nubank Empresas · 01/10/2026" },
  ];
  it("sai só a conexão com todos os lotes nos perfis limpos", () => {
    expect(conexoesDosPerfis(conexoes, lotes, new Set(["pes"]))).toEqual(["nu"]);
  });
  it("conexão espalhada fica até limpar os dois perfis", () => {
    expect(conexoesDosPerfis(conexoes, lotes, new Set(["pes", "emp"])).sort()).toEqual(["itau", "misto", "nu"]);
  });
  it("conexão que nunca importou fica", () => {
    expect(conexoesDosPerfis(conexoes, lotes, new Set(["pes", "emp"]))).not.toContain("inter");
  });
});

describe("partes da limpeza", () => {
  it("Categorias puxa Lançamentos e Orçamento; o resto não puxa nada", () => {
    expect(comDependencias(["categorias"])).toEqual(["lancamentos", "orcamento", "categorias"]);
    expect(comDependencias(["metas"])).toEqual(["metas"]);
    expect(comDependencias(["carteira", "lancamentos"])).toEqual(["lancamentos", "carteira"]);
  });

  it("lerPartes recusa lista vazia, parte inventada e o que não é lista", () => {
    for (const v of [[], ["conta"], ["metas", "senha"], "metas", null, undefined, [1]]) expect(lerPartes(v), JSON.stringify(v)).toBeNull();
    expect(lerPartes(["categorias", "metas", "metas"])).toEqual(["lancamentos", "orcamento", "metas", "categorias"]);
  });

  it("na tela: marcar Categorias marca o que ela precisa; desmarcar Lançamentos ou Orçamento tira Categorias", () => {
    expect(alternarParte(["metas"], "categorias")).toEqual(["lancamentos", "orcamento", "metas", "categorias"]);
    expect(alternarParte([...PARTES], "lancamentos")).not.toContain("categorias");
    expect(alternarParte([...PARTES], "orcamento")).not.toContain("categorias");
    expect(alternarParte([...PARTES], "metas")).toEqual(PARTES.filter((p) => p !== "metas"));
    expect(alternarParte(["lancamentos", "orcamento", "categorias"], "categorias")).toEqual(["lancamentos", "orcamento"]);
  });

  it("toda combinação que a tela gera já está fechada nas dependências", () => {
    // Liga e desliga em todas as ordens curtas: o resultado nunca muda ao passar pelo servidor.
    for (const a of PARTES) for (const b of PARTES) for (const c of PARTES) {
      const r = alternarParte(alternarParte(alternarParte([...PARTES], a), b), c);
      expect(comDependencias(r)).toEqual(r);
    }
  });

  it("volta ao começo só quando os lançamentos saem", () => {
    expect(voltaAoComeco(["metas", "carteira"])).toBe(false);
    expect(voltaAoComeco(["lancamentos"])).toBe(true);
  });
});

describe("Por que está limpando?", () => {
  it("só as respostas da lista (e o Pular) valem", () => {
    for (const m of MOTIVOS_DA_LIMPEZA) expect(ehRespostaDoMotivo(m)).toBe(true);
    expect(ehRespostaDoMotivo("pulou")).toBe(true);
    expect(ehRespostaDoMotivo("qualquer coisa")).toBe(false);
    expect(ehRespostaDoMotivo(undefined)).toBe(false);
    expect(caminhoDoMotivo("repetido")).toBe("/configuracoes/limpar/motivo/repetido");
  });
  it("só importei errado e repetido ganham a saída menor", () => {
    expect(MOTIVOS_DA_LIMPEZA.filter(temSaidaMenor)).toEqual(["importei_errado", "repetido"]);
    expect(temSaidaMenor("pulou")).toBe(false);
  });
});
