import { describe, expect, it } from "vitest";
import { abreTeclado, alturaDoTeclado } from "../teclado";

describe("teclado do iPhone sobre a folha", () => {
  it("a altura do teclado é o que falta entre a tela e a janela visível", () => {
    // iPhone 13: 844 de tela; com o teclado, a janela visível fica com 508.
    expect(alturaDoTeclado({ alturaDaJanela: 844, alturaVisivel: 508, topoVisivel: 0 })).toBe(336);
    // Rolou a página com o teclado aberto: o topo visível desce, o teclado continua o mesmo.
    expect(alturaDoTeclado({ alturaDaJanela: 844, alturaVisivel: 508, topoVisivel: 40 })).toBe(296);
  });
  it("a barra do Safari aparecendo não é teclado", () => {
    expect(alturaDoTeclado({ alturaDaJanela: 844, alturaVisivel: 790, topoVisivel: 0 })).toBe(0);
    expect(alturaDoTeclado({ alturaDaJanela: 844, alturaVisivel: 844, topoVisivel: 0 })).toBe(0);
  });
  it("só campo de digitar abre teclado", () => {
    const el = (tag: string, type?: string) => ({ tagName: tag, type, isContentEditable: false }) as unknown as Element;
    expect(abreTeclado(el("INPUT", "text"))).toBe(true);
    expect(abreTeclado(el("INPUT", "number"))).toBe(true);
    expect(abreTeclado(el("TEXTAREA"))).toBe(true);
    expect(abreTeclado(el("INPUT", "checkbox"))).toBe(false);
    expect(abreTeclado(el("BUTTON"))).toBe(false);
    expect(abreTeclado(null)).toBe(false);
  });
});
