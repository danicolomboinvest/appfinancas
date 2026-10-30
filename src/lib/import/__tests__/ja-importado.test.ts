import { describe, expect, it } from "vitest";
import { fraseJaEstavamNoApp, jaEstavamNoApp } from "../ja-importado";

describe("a frase da tela de pronto quando o arquivo repete o que já estava", () => {
  it("diz quantos já estavam e quantos entraram, numa linha", () => {
    expect(fraseJaEstavamNoApp(5, 3)).toBe("5 já estavam no app, trouxe só os 3 novos.");
    expect(fraseJaEstavamNoApp(1, 1)).toBe("1 já estava no app, trouxe só 1 novo.");
    expect(fraseJaEstavamNoApp(12, 1)).toBe("12 já estavam no app, trouxe só 1 novo.");
  });

  it("sem repetido, ou sem nada novo, a tela usa a frase de sempre", () => {
    expect(fraseJaEstavamNoApp(0, 7)).toBeNull();
    expect(fraseJaEstavamNoApp(4, 0)).toBeNull();
  });
});

describe("quantas a leitura já deu como 'já estava no app'", () => {
  it("conta só o lançado à mão igual (com id): o de outro arquivo é contado pela gravação", () => {
    expect(
      jaEstavamNoApp([
        { jaNoApp: { id: "e1" } },
        { jaNoApp: { id: "" } },
        { jaNoApp: { id: "e2", faturaAberta: true } },
        { jaNoApp: { id: "e3", paguei: true } },
        { jaNoApp: { id: "e4" }, ignorar: true },
        { jaNoApp: null },
        {},
      ]),
    ).toBe(1);
  });
});
