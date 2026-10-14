import { describe, expect, it } from "vitest";
import { PROFILE_THEMES } from "../themes";
import { vozDoTema } from "../voice";

/**
 * Frases da importação com número (14/10/2026): a tela mostrava "as 1 seguintes entram sozinhas",
 * "1 lançamentos importados" e "1 já existiam". Em todo tema, 1 fala no singular.
 */
describe("importação: singular com 1", () => {
  for (const tema of PROFILE_THEMES) {
    for (const kind of ["PESSOAL", "EMPRESA"]) {
      const t = vozDoTema(tema.key, kind).titulos;
      it(`${tema.key} (${kind})`, () => {
        expect(t.impParcela(2, 3, 1)).not.toMatch(/\bas 1\b/);
        expect(t.impParcela(2, 3, 1)).toMatch(/última/);
        expect(t.impParcela(1, 3, 2)).toMatch(/as 2 seguintes/);
        expect(t.impToastImportados(1)).not.toMatch(/\b1 lançamentos\b/);
        expect(t.impToastJaExistiam(1)).not.toMatch(/\b1 já (existiam|estavam)\b/);
        expect(t.impImportadosSucesso(1)).not.toMatch(/\b1 lançamentos\b/);
        expect(t.impParcelasFuturas(1)).toMatch(/1 parcela\b/);
        expect(t.impParcelasFuturas(3)).toMatch(/3 parcelas\b/);
      });
    }
  }
});
