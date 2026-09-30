import { describe, expect, it } from "vitest";
import { destinoDaNavegacao, type ToqueNoLink } from "../nav-progress-link";

const LOCAL = { origin: "https://app.spifinance.com.br", pathname: "/mensal/foco" };
const toque = (href: string | null, extra: Partial<ToqueNoLink> = {}): ToqueNoLink => ({
  href,
  target: null,
  download: false,
  button: 0,
  comModificador: false,
  ...extra,
});

describe("destinoDaNavegacao: quando a barrinha do topo acende", () => {
  it("link interno pra outra tela acende (barra de baixo, menu Mais, menu lateral)", () => {
    expect(destinoDaNavegacao(toque("/planejamento/metas"), LOCAL)).toBe("/planejamento/metas");
    expect(destinoDaNavegacao(toque("/orcamento"), LOCAL)).toBe("/orcamento");
  });

  it("link com o endereço completo do próprio app também conta", () => {
    expect(destinoDaNavegacao(toque("https://app.spifinance.com.br/carteira"), LOCAL)).toBe("/carteira");
  });

  it("link relativo é resolvido a partir da tela atual", () => {
    expect(destinoDaNavegacao(toque("gastos"), { ...LOCAL, pathname: "/mensal/" })).toBe("/mensal/gastos");
  });

  it("tocar na aba da tela em que ela já está não acende: nada vai trocar pra apagar a barra", () => {
    expect(destinoDaNavegacao(toque("/mensal/foco"), LOCAL)).toBeNull();
    // Só a busca muda (?view=anual): a tela é a mesma, o fim da navegação não seria percebido.
    expect(destinoDaNavegacao(toque("/mensal/foco?view=anual"), LOCAL)).toBeNull();
  });

  it("âncora na mesma página, e-mail, telefone e WhatsApp não acendem", () => {
    expect(destinoDaNavegacao(toque("#extrato-ou-fatura"), LOCAL)).toBeNull();
    expect(destinoDaNavegacao(toque("mailto:suporte@exemplo.com"), LOCAL)).toBeNull();
    expect(destinoDaNavegacao(toque("tel:+5511999999999"), LOCAL)).toBeNull();
    expect(destinoDaNavegacao(toque("https://wa.me/5511999999999"), LOCAL)).toBeNull();
  });

  it("abrir em outra aba, baixar arquivo ou clicar com Ctrl/Cmd não acende: esta tela fica", () => {
    expect(destinoDaNavegacao(toque("/guia", { target: "_blank" }), LOCAL)).toBeNull();
    expect(destinoDaNavegacao(toque("/api/export", { download: true }), LOCAL)).toBeNull();
    expect(destinoDaNavegacao(toque("/guia", { comModificador: true }), LOCAL)).toBeNull();
    expect(destinoDaNavegacao(toque("/guia", { button: 1 }), LOCAL)).toBeNull();
  });

  it("target _self é o normal e acende", () => {
    expect(destinoDaNavegacao(toque("/guia", { target: "_self" }), LOCAL)).toBe("/guia");
  });

  it("href vazio ou ausente não acende", () => {
    expect(destinoDaNavegacao(toque(null), LOCAL)).toBeNull();
    expect(destinoDaNavegacao(toque("   "), LOCAL)).toBeNull();
  });
});
