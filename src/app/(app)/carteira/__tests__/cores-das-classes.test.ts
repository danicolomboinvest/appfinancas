import { describe, expect, it } from "vitest";
import { AssetClass } from "@prisma/client";
import { CLASS_COLOR, CLASS_ORDER } from "../cores-das-classes";

const TODAS = Object.values(AssetClass);

describe("cores da rosca 'Por tipo'", () => {
  it("toda classe de ativo tem cor e lugar na ordem", () => {
    for (const classe of TODAS) {
      expect(CLASS_COLOR[classe], classe).toBeTruthy();
      expect(CLASS_ORDER, classe).toContain(classe);
    }
    expect(CLASS_ORDER).toHaveLength(TODAS.length);
  });

  it("uma cor por fatia: nenhuma classe repete a cor de outra", () => {
    const cores = CLASS_ORDER.map((c) => CLASS_COLOR[c]);
    expect(new Set(cores).size).toBe(cores.length);
  });

  it("Renda Fixa e Tesouro Direto não saem mais com a mesma cor", () => {
    expect(CLASS_COLOR.RENDA_FIXA).not.toBe(CLASS_COLOR.TESOURO_DIRETO);
  });

  it("Fundos e Cripto não saem mais no cinza de Outros", () => {
    expect(CLASS_COLOR.FUNDO).not.toBe(CLASS_COLOR.OUTRO);
    expect(CLASS_COLOR.CRIPTO).not.toBe(CLASS_COLOR.OUTRO);
  });

  it("só usa tokens de gráfico que já existem (nenhuma cor solta)", () => {
    for (const cor of Object.values(CLASS_COLOR)) {
      expect(cor).toMatch(/^var\(--color-(strat-(pos|ipca|pre|acoes|fiis|exterior|outros)|chart-[567])\)$/);
    }
  });

  it("Cripto (lilás do chart-5) fica longe de Fundos (lilás do strat-pre) na rosca", () => {
    const i = CLASS_ORDER.indexOf("CRIPTO");
    const j = CLASS_ORDER.indexOf("FUNDO");
    const distancia = Math.min(Math.abs(i - j), CLASS_ORDER.length - Math.abs(i - j));
    expect(distancia).toBeGreaterThan(1);
  });
});
