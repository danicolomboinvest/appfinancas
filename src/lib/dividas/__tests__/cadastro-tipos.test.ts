import { describe, expect, it } from "vitest";
import { escolherTipo, TIPOS } from "../tipos";

/**
 * "Tocar em Parcelamento não faz nada" (11/10/2026): todo tipo do cadastro tem que valer. O
 * cadastro inteiro foi conferido no navegador (emulação de iPhone) tocando nos 11; aqui fica a
 * regra do toque, para nenhum tipo virar botão morto.
 */
describe("Que tipo? (cadastro de dívida)", () => {
  it("são 11 tipos, cada um com nome e ícone", () => {
    expect(TIPOS).toHaveLength(11);
    for (const t of TIPOS) {
      expect(t.nome.length).toBeGreaterThan(0);
      expect(t.icone.length).toBeGreaterThan(0);
    }
  });

  it("tocar em qualquer tipo grava o tipo, inclusive o Parcelamento de fatura", () => {
    for (const t of TIPOS) {
      expect(escolherTipo(null, t.id, false).tipo).toBe(t.id);
      expect(escolherTipo("rotativo", t.id, false).tipo).toBe(t.id);
      expect(escolherTipo(t.id, t.id, true).tipo).toBe(t.id);
    }
    expect(TIPOS.find((t) => t.id === "cartao_parcelado")?.nome).toBe("Parcelamento de fatura");
  });

  it("trocar de tipo num cadastro novo zera a taxa; Devo para alguém começa em 0%", () => {
    expect(escolherTipo("rotativo", "cartao_parcelado", false)).toEqual({ tipo: "cartao_parcelado", taxa: null, naoSei: false });
    expect(escolherTipo(null, "pessoa", false)).toEqual({ tipo: "pessoa", taxa: 0, naoSei: false });
    // Editando, a taxa que ela já deu não some.
    expect(escolherTipo("rotativo", "emprestimo", true)).toEqual({ tipo: "emprestimo" });
  });
});
