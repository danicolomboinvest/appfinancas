import { describe, expect, it } from "vitest";
import { limparOrdem, ordemQueVale, ORDEM_PADRAO } from "../cartoes";

describe("cartões do Resumo", () => {
  it("quem nunca editou vê o Resumo de hoje, com a faixa do dia no topo", () => {
    expect(ordemQueVale(null)).toEqual(["hoje", "mes", "cats", "semana", "proximos"]);
    expect(ordemQueVale(undefined)).toEqual([...ORDEM_PADRAO]);
  });

  it("a escolha salva manda, na ordem dela", () => {
    expect(ordemQueVale(["semana", "hoje"])).toEqual(["semana", "hoje"]);
  });

  it("tirar todos os cartões é uma escolha válida, não volta ao padrão", () => {
    expect(ordemQueVale([])).toEqual([]);
  });

  it("aceita os cartões novos e uma meta escolhida, mas não um id de meta inventado", () => {
    expect(limparOrdem(["hoje", "meta:cmv5nh2470006jr06", "reserva", "meta:", "meta:../x"])).toEqual(["hoje", "meta:cmv5nh2470006jr06", "reserva"]);
  });

  it("ignora o que não é cartão e o que veio repetido", () => {
    expect(limparOrdem(["mes", "xis", "mes", 3, null, "cats"])).toEqual(["mes", "cats"]);
    expect(limparOrdem("mes")).toEqual([]);
  });
});
