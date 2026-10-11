import { describe, expect, it } from "vitest";
import {
  alternarPasso,
  apelidoLimpo,
  atalhoDoQuer,
  BANCOS_DO_COMECO,
  bancoDoComeco,
  barraDoPasso,
  caminhoDoEvento,
  centavosParaReais,
  COMECO_NOVO,
  EVENTOS_DO_COMECO,
  faseDoPasso,
  juntarComeco,
  lerComeco,
  mesDoTexto,
  montarFunilDoComeco,
  mostrarPrimeirosPassos,
  notaDoBanco,
  oQueMostrarDepois,
  passoAnterior,
  passoDeVolta,
  PREMIO_DOS_PRIMEIROS_PASSOS,
  primeirosPassos,
  pularComeco,
  rendaDaRegua,
  ahaDoMes,
  teclarValor,
  terminarComLancamento,
  type PassoDoComeco,
} from "../comeco";

const sinaisVazios = { temImportacao: false, temOrcamento: false, temMeta: false, temLembretes: false };
const agora = new Date("2026-10-11T15:00:00Z");

describe("quem já usava o app não passa pelo começo", () => {
  it("comeco nulo continua nulo (é o que separa quem já usava)", () => {
    expect(lerComeco(null)).toBeNull();
    expect(lerComeco(undefined)).toBeNull();
    expect(lerComeco([])).toBeNull();
  });
  it("sem começo novo, a Visão geral não mostra aha, convite nem Primeiros passos", () => {
    expect(oQueMostrarDepois(null, false)).toBe("nada");
    expect(mostrarPrimeirosPassos(null)).toBe(false);
  });
});

describe("lerComeco: não confia no que está gravado", () => {
  it("campo torto volta ao padrão", () => {
    const c = lerComeco({ passo: "inventado", renda: "abc", quer: "ficar rica", banco: "banco-que-nao-existe", manual: ["meta", "x", "meta"] });
    expect(c).toMatchObject({ passo: "b1", renda: null, quer: null, banco: null, manual: ["meta"] });
  });
  it("guarda o que é válido", () => {
    const c = lerComeco({ passo: "porta", apelido: "  Ana  ", renda: 4520, quer: "dividas", banco: "nubank", mesDoExtrato: "2026-09" });
    expect(c).toMatchObject({ passo: "porta", apelido: "Ana", renda: 4500, quer: "dividas", banco: "nubank", mesDoExtrato: "2026-09" });
  });
});

describe("as respostas", () => {
  it("renda da régua: arredonda no passo e fica entre R$ 1 mil e R$ 20 mil", () => {
    expect(rendaDaRegua(4380)).toBe(4500);
    expect(rendaDaRegua(200)).toBe(1000);
    expect(rendaDaRegua(90000)).toBe(20000);
    expect(rendaDaRegua(0)).toBeNull();
    expect(rendaDaRegua("x")).toBeNull();
  });
  it("apelido: limpo e curto", () => {
    expect(apelidoLimpo("  Ana   Lima ")).toBe("Ana Lima");
    expect(apelidoLimpo("<b>Ana</b>")).toBe("bAna/b");
    expect(apelidoLimpo("   ")).toBeNull();
    expect(apelidoLimpo("a".repeat(40))).toHaveLength(24);
  });
  it("juntar não perde o que já foi respondido", () => {
    const a = juntarComeco(null, { apelido: "Ana", passo: "renda" });
    const b = juntarComeco(a, { renda: 3000, passo: "quer" });
    expect(b).toMatchObject({ apelido: "Ana", renda: 3000, passo: "quer" });
  });
});

describe("os passos e a barra de cima", () => {
  it("fases como no protótipo", () => {
    expect(faseDoPasso("b2")).toBe("Boas-vindas");
    expect(faseDoPasso("renda")).toBe("Sobre você");
    expect(faseDoPasso("banco")).toBe("Seu primeiro lançamento");
  });
  it("3 pontos, 4 traços nas perguntas, 4 no lançamento", () => {
    expect(barraDoPasso("b3")).toEqual({ tipo: "pontos", total: 3, atual: 2 });
    expect(barraDoPasso("tema")).toEqual({ tipo: "tracos", total: 4, atual: 3 });
    expect(barraDoPasso("tutorial")).toEqual({ tipo: "tracos", total: 4, atual: 2 });
    expect(barraDoPasso("digitar").atual).toBe(1);
  });
  it("voltar: digitar e falar voltam para a porta; tutorial para o banco", () => {
    expect(passoAnterior("digitar")).toBe("porta");
    expect(passoAnterior("tutorial")).toBe("banco");
    expect(passoAnterior("b1")).toBeNull();
    expect(passoAnterior("volta")).toBeNull();
  });
});

describe("Pular em qualquer tela", () => {
  const passos: PassoDoComeco[] = ["b1", "b2", "b3", "nome", "renda", "quer", "tema", "porta", "banco", "tutorial", "lendo", "digitar", "falar"];
  it.each(passos)("pular em %s termina o começo sem perder nada e mostra o convite", (p) => {
    const antes = juntarComeco(null, { apelido: "Ana", renda: 3000, quer: "sonho", passo: p });
    const c = pularComeco(antes, p, agora);
    expect(c).toMatchObject({ pulou: true, passo: p, apelido: "Ana", renda: 3000, quer: "sonho", terminouEm: agora.toISOString() });
    expect(oQueMostrarDepois(c, false)).toBe("convite");
    expect(mostrarPrimeirosPassos(c)).toBe(true);
    expect(primeirosPassos(c, sinaisVazios).feitos).toBe(0);
  });
  it("quem pulou e depois lançou pelo + não vê mais o convite", () => {
    const c = pularComeco(null, "porta", agora);
    expect(oQueMostrarDepois(c, true)).toBe("nada");
  });
  it("ver o começo de novo volta onde parou; a leitura do extrato volta ao tutorial", () => {
    expect(passoDeVolta(pularComeco(null, "quer", agora), null)).toBe("quer");
    expect(passoDeVolta(pularComeco(null, "lendo", agora), null)).toBe("tutorial");
    expect(passoDeVolta(null, null)).toBe("b1");
    expect(passoDeVolta(null, "banco")).toBe("banco");
    expect(passoDeVolta(null, "volta")).toBe("banco");
    expect(passoDeVolta(juntarComeco(null, { banco: "itau" }), "volta")).toBe("volta");
  });
});

describe("o primeiro lançamento termina no aha", () => {
  it("extrato: aha do mês, extrato e revisão já marcados nos Primeiros passos", () => {
    const c = terminarComLancamento(null, "extrato", { mesDoExtrato: "2026-09", revisou: true }, agora);
    expect(oQueMostrarDepois(c, true)).toBe("mes");
    const p = primeirosPassos(c, sinaisVazios);
    expect(p.feitos).toBe(2);
    expect(p.passos.slice(0, 2).every((x) => x.feito)).toBe(true);
  });
  it("digitado ou falado: aha do primeiro gasto, com o convite do extrato", () => {
    expect(oQueMostrarDepois(terminarComLancamento(null, "digitado", {}, agora), true)).toBe("primeiroGasto");
    expect(oQueMostrarDepois(terminarComLancamento(null, "falado", {}, agora), true)).toBe("primeiroGasto");
  });
  it("trouxe o extrato depois de um gasto digitado: vale o extrato", () => {
    const a = terminarComLancamento(null, "digitado", {}, agora);
    const b = terminarComLancamento(a, "extrato", { mesDoExtrato: "2026-10" }, agora);
    expect(b.lancou).toBe("extrato");
    expect(oQueMostrarDepois(b, true)).toBe("mes");
  });
  it("fechar o aha some com ele", () => {
    const c = { ...terminarComLancamento(null, "extrato", {}, agora), aha: false };
    expect(oQueMostrarDepois(c, true)).toBe("nada");
  });
});

describe("Primeiros passos", () => {
  const c = terminarComLancamento(null, "digitado", {}, agora);
  it("marcam sozinhos pelos dados", () => {
    const p = primeirosPassos(c, { temImportacao: true, temOrcamento: true, temMeta: false, temLembretes: true });
    expect(p.passos.filter((x) => x.feito).map((x) => x.chave)).toEqual(["extrato", "plano", "lembretes"]);
    expect(p.feitos).toBe(3);
  });
  it("marcar à mão e desmarcar; desmarcar não apaga o que os dados provam", () => {
    const marcado = alternarPasso(c, "meta");
    expect(primeirosPassos(marcado, sinaisVazios).feitos).toBe(1);
    const desmarcado = alternarPasso(marcado, "meta");
    expect(primeirosPassos(desmarcado, sinaisVazios).feitos).toBe(0);
    const comMeta = alternarPasso(c, "meta");
    expect(primeirosPassos(alternarPasso(comMeta, "meta"), { ...sinaisVazios, temMeta: true }).feitos).toBe(1);
  });
  it("cinco de cinco é completo; fechar tira o cartão", () => {
    const p = primeirosPassos(c, { temImportacao: true, temOrcamento: true, temMeta: true, temLembretes: true });
    expect(p.completo).toBe(false);
    const todos = primeirosPassos({ ...c, revisou: true }, { temImportacao: true, temOrcamento: true, temMeta: true, temLembretes: true });
    expect(todos.completo).toBe(true);
    expect(mostrarPrimeirosPassos({ ...c, passosFechados: true })).toBe(false);
  });
  it("o prêmio não é tema exclusivo (os temas são quatro e abertos)", () => {
    expect(PREMIO_DOS_PRIMEIROS_PASSOS.antes.toLowerCase()).not.toContain("tema");
    expect(PREMIO_DOS_PRIMEIROS_PASSOS.depois.toLowerCase()).not.toContain("tema");
  });
});

describe("bancos", () => {
  it("o selo 'a conferir' não existe em lugar nenhum (decisão de 11/10)", () => {
    for (const b of BANCOS_DO_COMECO) {
      expect(JSON.stringify(b).toLowerCase()).not.toContain("conferir");
      expect(notaDoBanco(b).toLowerCase()).not.toContain("conferir");
    }
  });
  it("banco não conferido usa o caminho e a nota genéricos", () => {
    const c6 = bancoDoComeco("c6")!;
    expect(c6.conferido).toBe(false);
    expect(notaDoBanco(c6)).toBe("Salve o arquivo no celular e volte aqui.");
    expect(notaDoBanco(bancoDoComeco("caixa")!)).toContain("site da Caixa");
  });
  it("os oito conferidos vêm primeiro", () => {
    expect(BANCOS_DO_COMECO.slice(0, 8).every((b) => b.conferido)).toBe(true);
    expect(bancoDoComeco("outro")?.nome).toBe("seu banco");
    expect(bancoDoComeco("nada")).toBeNull();
  });
});

describe("o aha não inventa número", () => {
  it("total, maior categoria e a barrinha pelo mês montado", () => {
    const r = ahaDoMes({ saiu: 1876, maiores: [{ rotulo: "Moradia", valor: 946, fracao: 0.504 }, { rotulo: "Alimentação", valor: 612, fracao: 0.326 }, { rotulo: "Transporte", valor: 318, fracao: 0.17 }] });
    expect(r?.total).toBe(1876);
    expect(r?.maior).toEqual({ rotulo: "Moradia", valor: 946, pct: 50 });
    expect(r?.barras.map((b) => b.pct)).toEqual([50, 33, 17]);
    expect(r?.restoPct).toBe(0);
  });
  it("gasto sem categoria entra no total e vira resto", () => {
    const r = ahaDoMes({ saiu: 1000, maiores: [{ rotulo: "Lazer", valor: 600, fracao: 0.6 }] });
    expect(r?.restoPct).toBe(40);
  });
  it("sem gasto, sem aha", () => {
    expect(ahaDoMes(null)).toBeNull();
    expect(ahaDoMes({ saiu: 0, maiores: [] })).toBeNull();
  });
  it("mês do extrato por extenso", () => {
    expect(mesDoTexto("2026-09")).toEqual({ ano: 2026, mes: 9, nome: "setembro" });
    expect(mesDoTexto("2026-13")).toBeNull();
    expect(mesDoTexto(null)).toBeNull();
  });
});

describe("atalho do que ela quer", () => {
  it("cada resposta abre o seu lugar", () => {
    expect(atalhoDoQuer("dividas").href).toBe("/dividas");
    expect(atalhoDoQuer("sonho").href).toBe("/planejamento/metas");
    expect(atalhoDoQuer("investir").href).toBe("/carteira/estrategia");
    expect(atalhoDoQuer("organizar").href).toBe("/orcamento");
    expect(atalhoDoQuer(null).href).toBe("/orcamento");
  });
  it("Empresa e Casal não têm Dívidas nem Estratégia: caem no plano", () => {
    expect(atalhoDoQuer("dividas", true).href).toBe("/orcamento");
    expect(atalhoDoQuer("investir", true).href).toBe("/orcamento");
  });
});

describe("o gasto digitado", () => {
  it("teclado em centavos", () => {
    let s = "";
    for (const t of ["1", "2", "5", "0"]) s = teclarValor(s, t);
    expect(s).toBe("1250");
    expect(centavosParaReais(s)).toBe(12.5);
    expect(teclarValor(s, "apagar")).toBe("125");
    expect(teclarValor("", "0")).toBe("");
    expect(teclarValor("1234567", "8")).toBe("1234567");
    expect(teclarValor("12", "00")).toBe("1200");
  });
});

describe("o funil do começo (UsageEvent)", () => {
  it("todos os eventos pedidos existem", () => {
    expect(Object.keys(EVENTOS_DO_COMECO)).toEqual(["comecou", "pergunta", "porta", "banco", "enviou", "revisou", "viuMes", "pulou"]);
  });
  it("o caminho só leva pedaços conhecidos, nunca o que ela digitou", () => {
    expect(caminhoDoEvento("comeco_banco", "nubank")).toBe("/comecar/banco/nubank");
    expect(caminhoDoEvento("comeco_pergunta", "renda")).toBe("/comecar/pergunta/renda");
    expect(caminhoDoEvento("comeco_pergunta", "Ana Lima 4500")).toBe("/comecar/pergunta");
    expect(caminhoDoEvento("comeco_comecou")).toBe("/comecar/comecou");
  });
  it("monta o funil na ordem do começo", () => {
    const f = montarFunilDoComeco({ comeco_comecou: 10, "comeco_pergunta:/comecar/pergunta/tema": 8, comeco_porta: 7, comeco_viu_mes: 4 });
    expect(f.map((x) => x.rotulo)).toEqual(["Começou", "Respondeu as perguntas", "Escolheu a porta", "Escolheu o banco", "Enviou o extrato", "Revisou", "Viu o mês"]);
    expect(f.map((x) => x.pessoas)).toEqual([10, 8, 7, 0, 0, 0, 4]);
  });
});

describe("textos sem travessão nem emoji", () => {
  it("nada do começo usa travessão", () => {
    const tudo = JSON.stringify({ BANCOS_DO_COMECO, PREMIO_DOS_PRIMEIROS_PASSOS, COMECO_NOVO });
    expect(tudo).not.toMatch(/[—–]/);
    expect(tudo).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
