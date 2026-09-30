import { describe, expect, it } from "vitest";
import { casarPorDataEValor, descricaoNormalizada, mesmaDescricao } from "../duplicata-solta";

describe("mesmaDescricao", () => {
  it("ignora maiúscula, acento e pontuação", () => {
    expect(descricaoNormalizada("PIX ENVIADO - Transferência")).toBe("pix enviado transferencia");
    expect(mesmaDescricao("PIX ENVIADO - Maria", "Pix enviado Maria")).toBe(true);
  });

  it("descrição cortada por um formato é a mesma, se o pedaço tem nome", () => {
    expect(mesmaDescricao("PIX ENVIADO MARIA SIL", "Pix enviado Maria Silva")).toBe(true);
    expect(mesmaDescricao("PIX ENVIADO", "Pix enviado Maria Silva")).toBe(false);
  });

  it("gasto de outra conta no mesmo valor não é o mesmo", () => {
    expect(mesmaDescricao("SAQUE 24H", "PIX ENVIADO MARIA")).toBe(false);
    expect(mesmaDescricao(null, "SAQUE")).toBe(false);
  });
});

describe("casarPorDataEValor", () => {
  const existentes = () => new Map([["2026-09-10|100.00|EXPENSE", [{ descricao: "PIX ENVIADO MARIA" }]]]);

  it("na leitura, descrição diferente vira 'parecido' com a descrição do que já existe", () => {
    const r = casarPorDataEValor(["2026-09-10|100.00|EXPENSE"], ["SAQUE 24H"], existentes(), { perguntar: true });
    expect(r.get(0)).toEqual({ tipo: "parecido", descricao: "PIX ENVIADO MARIA" });
  });

  it("na confirmação, descrição diferente não casa (entra)", () => {
    const r = casarPorDataEValor(["2026-09-10|100.00|EXPENSE"], ["SAQUE 24H"], existentes(), { perguntar: false });
    expect(r.size).toBe(0);
  });

  it("a descrição igual ganha a vaga antes da diferente, venha em que ordem vier", () => {
    const r = casarPorDataEValor(
      ["2026-09-10|100.00|EXPENSE", "2026-09-10|100.00|EXPENSE"],
      ["SAQUE 24H", "Pix enviado Maria"],
      existentes(),
      { perguntar: true },
    );
    expect(r.get(1)).toEqual({ tipo: "mesmo" });
    expect(r.has(0)).toBe(false);
  });

  it("o que a chave exata já pulou gasta a vaga do seu par, e não a de outro", () => {
    const r = casarPorDataEValor(
      ["2026-09-10|100.00|EXPENSE", "2026-09-10|100.00|EXPENSE"],
      ["Pix enviado Maria", "Pix enviado Maria"],
      existentes(),
      { perguntar: false, jaCasados: new Set([0]) },
    );
    // Um lançamento só no banco: o item 0 já ficou com ele, o 1 (repetido no arquivo) entra.
    expect(r.size).toBe(0);
  });

  it("não mexe no mapa recebido", () => {
    const e = existentes();
    casarPorDataEValor(["2026-09-10|100.00|EXPENSE"], ["Pix enviado Maria"], e, { perguntar: true });
    expect(e.get("2026-09-10|100.00|EXPENSE")).toEqual([{ descricao: "PIX ENVIADO MARIA" }]);
  });

  it("compara pelo nome do banco e mostra o nome que ela deu", () => {
    const e = new Map([["2026-09-10|100.00|EXPENSE", [{ descricao: "PIX ENVIADO MARIA", mostrar: "Presente da Maria" }]]]);
    expect(casarPorDataEValor(["2026-09-10|100.00|EXPENSE"], ["Pix enviado Maria"], e, { perguntar: true }).get(0)).toEqual({ tipo: "mesmo" });
    expect(casarPorDataEValor(["2026-09-10|100.00|EXPENSE"], ["SAQUE 24H"], e, { perguntar: true }).get(0)).toEqual({
      tipo: "parecido",
      descricao: "Presente da Maria",
    });
  });
});
