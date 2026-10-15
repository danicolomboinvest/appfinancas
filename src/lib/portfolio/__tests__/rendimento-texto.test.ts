import { describe, expect, it } from "vitest";
import { linhaDoRendimento } from "../rendimento-texto";

describe("linha do rendimento", () => {
  const ref = "2026-10-14T00:00:00.000Z";

  it("CDI com a data do último dia", () => {
    expect(linhaDoRendimento({ como: "cdi", referenteA: ref, estimado: false, semTaxa: false })).toEqual({ texto: "Estimado pelo CDI de 14/10, antes do IR", fonte: "Banco Central", nota: null });
  });

  it("sem taxa diz que usou 100% do CDI", () => {
    expect(linhaDoRendimento({ como: "cdi", referenteA: ref, estimado: true, semTaxa: true })?.texto).toBe("Estimado com 100% do CDI de 14/10, antes do IR");
  });

  it("IPCA pelo mês, e avisa quando o mês atual é estimado", () => {
    const l = linhaDoRendimento({ como: "ipca", referenteA: "2026-09-01T00:00:00.000Z", estimado: true, semTaxa: false });
    expect(l).toEqual({ texto: "Estimado pelo IPCA de set/26, antes do IR", fonte: "Banco Central", nota: "O mês atual usa o último IPCA divulgado." });
  });

  it("prefixado e Tesouro pelo preço", () => {
    expect(linhaDoRendimento({ como: "pre", referenteA: ref, estimado: false, semTaxa: false })?.texto).toBe("Estimado pela taxa da compra até 14/10, antes do IR");
    expect(linhaDoRendimento({ como: "tesouro", referenteA: ref, estimado: false, semTaxa: false })).toBeNull();
    expect(linhaDoRendimento({ como: null, referenteA: null, estimado: false, semTaxa: false })).toBeNull();
  });

  it("sem travessão", () => {
    for (const como of ["cdi", "ipca", "pre"]) expect(JSON.stringify(linhaDoRendimento({ como, referenteA: ref, estimado: true, semTaxa: true }))).not.toMatch(/[—–]/);
  });
});
