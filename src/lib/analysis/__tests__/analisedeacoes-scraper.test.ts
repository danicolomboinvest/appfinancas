import { describe, it, expect } from "vitest";
import { parseAnalisedeacoesPage } from "../analisedeacoes-scraper";

// Recorte com a estrutura real da página (rótulos abreviados exatos + <span> de ícone no valor).
const HTML = `
<div class="card-info-item"><strong class="item-label">P/L</strong><span class="item-value">4,86<span class="img-historical"></span></span></div>
<div class="card-info-item"><strong class="item-label">ROE</strong><span class="item-value">26%<span class="img-info"></span></span></div>
<div class="card-info-item"><strong class="item-label">Margem líq.</strong><span class="item-value">22%</span></div>
<div class="card-info-item"><strong class="item-label">Liq. corrente</strong><span class="item-value">0,74</span></div>
<div class="card-info-item"><strong class="item-label">Dív. liq / ebitda</strong><span class="item-value">1,01</span></div>
<div class="card-info-item"><strong class="item-label">Página de RI</strong><span class="item-value">Ver site</span></div>
`;

describe("parseAnalisedeacoesPage", () => {
  it("maps the site's abbreviated labels to internal keys and strips the icon span", () => {
    const map = parseAnalisedeacoesPage(HTML);
    expect(map.p_l).toBe("4,86");
    expect(map.roe).toBe("26%");
    expect(map.margem_liquida).toBe("22%");
    expect(map.liquidez_corrente).toBe("0,74");
    expect(map.divida_liquida_ebitda).toBe("1,01");
    // Rótulos que não conhecemos ("Página de RI") são ignorados.
    expect(Object.keys(map)).toHaveLength(5);
  });
});
