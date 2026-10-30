import { describe, expect, it } from "vitest";
import { diasDeUso, montarLinhaDoTempo, ondeParou, rotuloDoErro, rotuloDoUso, type DadosDaJornada, type TentativaDeImportacao } from "../jornada";

const t = (p: Partial<TentativaDeImportacao> = {}): TentativaDeImportacao => ({
  stage: "parse",
  ok: true,
  target: "extrato",
  kind: "statement",
  encoding: "pdf",
  message: null,
  parsed: 30,
  created: 0,
  ...p,
});

/** 13h UTC = 10h em Brasília. */
const em = (dia: string, h = 13) => new Date(`2026-10-${dia}T${String(h).padStart(2, "0")}:00:00Z`);

const base = (p: Partial<DadosDaJornada> = {}): DadosDaJornada => ({
  comprouEm: em("02"),
  via: "hubla",
  contaEm: em("02", 14),
  usos: [],
  tentativas: [],
  manuais: [],
  saiuEm: em("05"),
  comoSaiu: "reembolso",
  ...p,
});

describe("ondeParou", () => {
  it("segue a ordem do caminho", () => {
    expect(ondeParou({ temConta: false, tentativas: 0, lidas: 0, gravadas: 0 })).toBe("sem_conta");
    expect(ondeParou({ temConta: true, tentativas: 0, lidas: 0, gravadas: 0 })).toBe("nao_subiu");
    expect(ondeParou({ temConta: true, tentativas: 3, lidas: 0, gravadas: 0 })).toBe("nao_leu");
    expect(ondeParou({ temConta: true, tentativas: 2, lidas: 1, gravadas: 0 })).toBe("revisao");
    expect(ondeParou({ temConta: true, tentativas: 2, lidas: 2, gravadas: 1 })).toBe("usou");
  });

  it("gravou sem diagnóstico de leitura (lote antigo) conta como usou", () => {
    expect(ondeParou({ temConta: true, tentativas: 0, lidas: 0, gravadas: 1 })).toBe("usou");
  });
});

describe("rotuloDoErro", () => {
  it("separa os erros comuns em palavras curtas", () => {
    expect(rotuloDoErro(t({ ok: false, message: "Senha incorreta. Tente de novo." }))).toBe("Senha");
    expect(rotuloDoErro(t({ ok: false, kind: "print", message: "Não consegui ler" }))).toBe("Foto ou print");
    expect(rotuloDoErro(t({ ok: false, message: "Vi 40 linhas com valor, mas não consegui entender" }))).toBe("Formato desconhecido");
    expect(rotuloDoErro(t({ ok: false, target: "carteira", kind: "statement", message: "x" }))).toBe("Subiu na Carteira");
    expect(rotuloDoErro(t({ ok: false, kind: "conta-de-consumo", message: "x" }))).toBe("Não é extrato");
    expect(rotuloDoErro(t({ ok: true, parsed: 0, message: "Não encontrei transações nesse período" }))).toBe("Arquivo vazio");
    expect(rotuloDoErro(t({ ok: false, message: "algo novo" }))).toBe("Não leu");
  });
});

describe("rotuloDoUso", () => {
  it("dá nome de área às telas e aos toques", () => {
    expect(rotuloDoUso("pageview", "/mensal/foco")).toBe("Visão geral");
    expect(rotuloDoUso("pageview", "/mensal/[ano]/[mes]")).toBe("Mês");
    expect(rotuloDoUso("pageview", "/planejamento/metas/[id]")).toBe("Metas");
    expect(rotuloDoUso("pageview", "/orcamentos-x")).toBe("Orcamentos x");
    expect(rotuloDoUso("registro_importacao", "/registrar")).toBe("Abriu Importar");
    expect(rotuloDoUso("comeco_porta", "/comecar/porta/extrato")).toBe("Começo");
  });
});

describe("montarLinhaDoTempo", () => {
  it("arquivo nunca lido: o ponto vermelho fica no dia das tentativas, com os erros", () => {
    const itens = montarLinhaDoTempo(
      base({
        tentativas: [
          { ...t({ ok: false, parsed: 0, message: "Senha incorreta" }), em: em("02", 15) },
          { ...t({ ok: false, parsed: 0, message: "Senha incorreta" }), em: em("02", 16) },
          { ...t({ ok: false, parsed: 0, kind: "print" }), em: em("02", 17) },
        ],
        manuais: [em("02", 18), em("02", 18)],
        usos: [
          { nome: "pageview", caminho: "/mensal/foco", em: em("02", 14) },
          { nome: "pageview", caminho: "/orcamento", em: em("04", 22) },
          { nome: "pageview", caminho: "/configuracoes", em: em("04", 22) },
        ],
      }),
    );
    expect(itens.map((i) => i.texto)).toEqual([
      "Comprou pela Hubla",
      "Criou a conta",
      "Abriu o app",
      "Tentou importar 3 vezes, não leu",
      "Lançou 2 à mão",
      "Último dia no app",
      "Pediu reembolso",
    ]);
    const tentativa = itens.find((i) => i.texto.startsWith("Tentou"))!;
    expect(tentativa.marca).toBe("parou");
    expect(tentativa.chips.map((c) => c.texto)).toEqual(["Senha", "Senha", "Foto ou print"]);
    expect(itens.find((i) => i.texto === "Último dia no app")!.chips.map((c) => c.texto)).toEqual(["Orçamento", "Configurações"]);
  });

  it("não subiu arquivo: diz se chegou a abrir Importar", () => {
    const abriu = montarLinhaDoTempo(base({ usos: [{ nome: "registro_importacao", caminho: "/registrar", em: em("02", 15) }] }));
    expect(abriu.find((i) => i.marca === "parou")!.texto).toBe("Abriu Importar e não subiu arquivo");
    const nunca = montarLinhaDoTempo(base());
    expect(nunca.find((i) => i.marca === "parou")!.texto).toBe("Nunca subiu um arquivo");
  });

  it("leu e não gravou: o ponto vermelho é a revisão", () => {
    const itens = montarLinhaDoTempo(base({ tentativas: [{ ...t({ parsed: 59 }), em: em("03") }] }));
    const r = itens.find((i) => i.marca === "parou")!;
    expect(r.texto).toBe("O app leu o arquivo e ela não gravou");
  });

  it("usou e parou: importou, e o vermelho vai no último dia", () => {
    const itens = montarLinhaDoTempo(
      base({
        tentativas: [
          { ...t({ parsed: 40 }), em: em("02", 15) },
          { ...t({ stage: "confirm", created: 40 }), em: em("02", 16) },
        ],
        usos: [
          { nome: "pageview", caminho: "/mensal/foco", em: em("02", 15) },
          { nome: "pageview", caminho: "/mensal/foco", em: em("09", 15) },
        ],
      }),
    );
    expect(itens.find((i) => i.texto === "Importou 40 lançamentos")!.marca).toBe("ok");
    expect(itens.find((i) => i.texto === "Último dia no app")!.marca).toBe("parou");
    expect(itens.filter((i) => i.marca === "parou")).toHaveLength(1);
  });

  it("último dia no mesmo dia da importação: vem depois dela", () => {
    const itens = montarLinhaDoTempo(
      base({
        tentativas: [{ ...t({ stage: "confirm", created: 12 }), em: em("02", 16) }],
        usos: [
          { nome: "pageview", caminho: "/mensal/foco", em: em("02", 15) },
          { nome: "pageview", caminho: "/orcamento", em: em("02", 17) },
        ],
      }),
    );
    expect(itens.map((i) => i.texto)).toEqual(["Comprou pela Hubla", "Criou a conta", "Importou 12 lançamentos", "Último dia no app", "Pediu reembolso"]);
  });

  it("sem conta: compra, não criou a conta e saiu", () => {
    const itens = montarLinhaDoTempo(base({ contaEm: null }));
    expect(itens.map((i) => i.texto)).toEqual(["Comprou pela Hubla", "Não criou a conta", "Pediu reembolso"]);
  });

  it("cancelou a renovação aparece como tal", () => {
    expect(montarLinhaDoTempo(base({ comoSaiu: "cancelou" })).at(-1)!.texto).toBe("Cancelou a renovação");
  });

  it("muitos erros: mostra 6 e diz quantos mais", () => {
    const tentativas = Array.from({ length: 9 }, (_, i) => ({ ...t({ ok: false, parsed: 0, message: "Senha" }), em: em("03", 12 + i) }));
    const item = montarLinhaDoTempo(base({ tentativas })).find((i) => i.texto.startsWith("Tentou"))!;
    expect(item.chips).toHaveLength(7);
    expect(item.chips.at(-1)!.texto).toBe("mais 3");
  });
});

describe("diasDeUso", () => {
  it("conta dias no fuso de Brasília", () => {
    // 02h UTC do dia 3 ainda é dia 2 em Brasília.
    expect(diasDeUso([{ em: em("02", 15) }, { em: em("03", 2) }, { em: em("03", 15) }])).toBe(2);
  });
});

describe("montarLinhaDoTempo com e-mail devolvido (Resend, 30/10/2026)", () => {
  it("põe a devolução no dia certo, com o assunto e o motivo em chip de erro", () => {
    const itens = montarLinhaDoTempo(
      base({
        saiuEm: null,
        comoSaiu: null,
        devolucoes: [
          { evento: "bounced", assunto: "Seu acesso ao SPI Finance", motivo: "mailbox does not exist", em: em("03") },
          { evento: "complained", assunto: null, motivo: null, em: em("04") },
        ],
      }),
    );
    const textos = itens.map((i) => i.texto);
    expect(textos).toEqual(["Comprou pela Hubla", "Criou a conta", "Nunca subiu um arquivo", "E-mail devolvido", "Marcou o e-mail como spam"]);
    const devolvido = itens[3];
    expect(devolvido.marca).toBe("parou");
    expect(devolvido.soDia).toBe(false);
    expect(devolvido.chips).toEqual([{ texto: "Seu acesso ao SPI Finance" }, { texto: "mailbox does not exist", erro: true }]);
    expect(itens[4].chips).toEqual([]);
  });

  it("sem o campo (dados antigos) a linha do tempo fica igual", () => {
    expect(montarLinhaDoTempo(base())).toEqual(montarLinhaDoTempo(base({ devolucoes: [] })));
  });
});
