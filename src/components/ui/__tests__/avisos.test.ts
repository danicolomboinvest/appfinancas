import { describe, expect, it } from "vitest";
import { PROFILE_THEMES } from "@/lib/profiles/themes";
import { vozDoTema } from "@/lib/profiles/voice";
import { LIMITE_DO_AVISO } from "../toast-context";

/**
 * Os avisos (14/10/2026, "B como regra, a pílula de A como exceção"): a pílula é escura em todo
 * tema e modo, com contraste para ler, e os textos que ainda viram pílula cabem nela.
 */

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe("pílula de aviso nos temas", () => {
  for (const tema of PROFILE_THEMES) {
    for (const [modo, paleta] of [["claro", tema.paleta], ["escuro", tema.paletaAlternativa]] as const) {
      it(`${tema.label} ${modo}: escura, com texto e Desfazer legíveis`, () => {
        const extras = paleta.extras ?? {};
        const fundo = extras["aviso"];
        const texto = extras["on-aviso"];
        const acao = extras["aviso-acao"];
        expect(fundo).toMatch(/^#[0-9a-f]{6}$/i);
        // Escura: o fundo é mais escuro que o texto, nos dois modos.
        expect(luminancia(fundo)).toBeLessThan(luminancia(texto));
        expect(contraste(fundo, texto)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(fundo, acao)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe("textos que ainda viram pílula", () => {
  for (const chave of ["padrao", "girly", "manifestacao", "titanio"]) {
    it(`${chave}: até ${LIMITE_DO_AVISO} caracteres`, () => {
      const t = vozDoTema(chave).titulos;
      const textos = [
        t.avisoTetoFeito("R$ 1.200", "Alimentação"),
        t.avisoNadaMaisFeito("Lazer"),
        t.avisoGuardarFeito("R$ 1.200"),
        t.avisoGuardarDepoisFeito,
        t.avisoFoiPara("Mercado", "Moradia"),
        t.avisoVirouGuardado("Mercado"),
        t.uiExcluido(1),
        t.uiExcluido(12),
        t.impHistoricoDesfeita(12),
        t.impAplicadoAosIguais(12),
        t.impToastImportados(120),
        t.limToastFalta("R$ 1.200"),
        t.limToastPassou("R$ 1.200"),
        t.cfgPushLigadoToast,
        t.cfgConexaoNovos(12),
        t.cfgPerfisTrocouToast("Casa"),
      ];
      expect(textos.filter((x) => x.length > LIMITE_DO_AVISO)).toEqual([]);
    });
  }
});
