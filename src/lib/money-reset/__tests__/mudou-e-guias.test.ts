import { describe, expect, it } from "vitest";
import { oQueMudou } from "../mudou";
import { GUIAS, comecoDoGuia } from "../guias";
import { marco } from "../missoes";

const sem = {};

describe("O que já mudou no seu SPI: sempre verdade", () => {
  it("quem não usa cartão não lê que as parcelas entraram no app", () => {
    expect(oQueMudou(2, { n: 2 }, { fatura: { texto: "sem cartao", dados: null } })).toEqual(["Anotado: você não usa cartão de crédito"]);
    expect(oQueMudou(2, { n: 2 }, sem)).toEqual(marco(2)!.mudou);
  });

  it("sem nada que se repete no extrato, o Raio-X não guardou decisão nenhuma", () => {
    expect(oQueMudou(3, { n: 3, itens: [], decididos: {} }, sem)).toEqual([]);
    // Só manteve: guardou, mas não tem o que perguntar no mês que vem.
    expect(oQueMudou(3, { n: 3, itens: [{}], decididos: { netflix: "raiox_manter" } }, sem)).toEqual([marco(3)!.mudou[0]]);
    expect(oQueMudou(3, { n: 3, itens: [{}], decididos: { netflix: "raiox_cancelar" } }, sem)).toEqual(marco(3)!.mudou);
  });

  it("a conta para negociar só aparece anotada se ela escolheu uma", () => {
    const fixas = { n: 4, fixas: [{}], parcelas: 0 };
    expect(oQueMudou(4, fixas, { fixas: { texto: "300", dados: { negociar: null } } })).toEqual(["Suas contas fixas ficaram somadas"]);
    expect(oQueMudou(4, fixas, { fixas: { texto: "300", dados: { negociar: "Vivo Fibra" } } })).toEqual(marco(4)!.mudou);
    expect(oQueMudou(4, { n: 4, fixas: [], parcelas: 0 }, { fixas: { texto: "0", dados: { negociar: null } } })).toEqual([]);
  });

  it("sem categoria acima da régua não houve teto: fica a dica combinada", () => {
    expect(oQueMudou(5, { n: 5, pior: null }, { dica: { texto: "lista", dados: null } })).toEqual(["A dica da semana ficou combinada"]);
    expect(oQueMudou(5, { n: 5, pior: "ALIMENTACAO" }, { dica: { texto: "lista", dados: null } })).toEqual(marco(5)!.mudou);
  });

  it("sem quanto guardar ou sem destino, o guardado não ganhou destino", () => {
    expect(oQueMudou(12, { n: 12, guardar: null, fatias: [] }, sem)).toEqual([]);
    expect(oQueMudou(12, { n: 12, guardar: 400, fatias: [] }, sem)).toEqual([]);
    expect(oQueMudou(12, { n: 12, guardar: 400, fatias: [{}] }, sem)).toEqual(marco(12)!.mudou);
  });

  it("quem não tem dívida não lê a data em que fica livre", () => {
    expect(oQueMudou(13, { n: 13, dividas: [] }, { dividas: { texto: "nenhuma", dados: null } })).toEqual(["Anotado: nenhuma dívida em aberto"]);
    expect(oQueMudou(13, { n: 13, dividas: [{}] }, { dividas: { texto: "1", dados: null } })).toEqual(marco(13)!.mudou);
  });

  it("as outras missões ficam com o texto da missão", () => {
    for (const n of [1, 6, 7, 9, 14, 21]) expect(oQueMudou(n, { n }, sem)).toEqual(marco(n)!.mudou);
  });
});

describe("guias do Money Reset", () => {
  it("o guia que começa pelo + já abre a gaveta e começa no passo seguinte (o + não existe no Money Reset)", () => {
    for (const n of [1, 2, 6, 16]) expect(comecoDoGuia(n), `marco ${n}`).toEqual({ passo: 1, abrirRegistrar: true });
    for (const n of [8, 10, 11, 18]) expect(comecoDoGuia(n), `marco ${n}`).toEqual({ passo: 0, abrirRegistrar: false });
  });

  it("nenhum passo aponta para um botão que saiu do app", () => {
    const alvos = Object.values(GUIAS).flatMap((ps) => ps.map((p) => p.alvo)).join(" ");
    // O tipo do arquivo é reconhecido sozinho; a tela da Reserva saiu; Metas não está na barra de baixo.
    expect(alvos).not.toMatch(/tipo-extrato|tipo-fatura|reserva-salvar|data-tour="metas"/);
  });

  it("o Posso comprar? abre o Mais opções antes, e tem o atalho direto", () => {
    const g = GUIAS[16];
    expect(g[1].alvo).toContain("summary");
    expect(g[2]).toMatchObject({ alvo: '[data-guia="posso-comprar"]', ir: "/decidir/comprar" });
  });

  it("o orçamento tem um passo para cada Continuar do assistente antes do Sugerir", () => {
    expect(GUIAS[8].map((p) => p.alvo)).toEqual(['[data-guia="orc-editar"]', '[data-guia="orc-ir-divisao"]', '[data-guia="orc-ir-divisao"]', '[data-guia="orc-sugerir"]']);
  });

  it("a reserva e o sonho levam às Metas e acendem o Nova meta", () => {
    for (const n of [10, 11]) expect(GUIAS[n][0]).toMatchObject({ rota: "/planejamento/metas", ir: "/planejamento/metas" });
  });
});
