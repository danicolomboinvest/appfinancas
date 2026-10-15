import type { Page } from "@playwright/test";

/**
 * Conferências que valem para qualquer tela: texto quebrado e layout a 375 px.
 */

export type ProblemaDeTexto = { trecho: string; motivo: string };

const PADROES: [RegExp, string][] = [
  [/R\$\s*NaN|NaN\s*%|\bNaN\b/, "NaN na tela"],
  [/\bundefined\b/, "undefined na tela"],
  [/\bnull\b/, "null na tela"],
  [/\[object Object\]/, "[object Object] na tela"],
  [/(?<![\d.,])1\s+(lançamentos|compras|contas|parcelas|assinaturas|metas|dias|meses|categorias|vezes|itens|pessoas|semanas)\b/i, "plural com 1"],
  [/[-−–]\s*R\$\s*0(?:,00)?(?![\d.,])/, "-R$ 0"],
  [/R\$\s*-\s*\d/, "R$ -X (sinal dentro)"],
  [/Invalid Date/, "Invalid Date"],
  [/\{\w+\}/, "chave de texto sem trocar"],
];

/** O texto visível da página, sem o que está escondido. */
export async function textoVisivel(p: Page): Promise<string> {
  return p.evaluate(() => document.body.innerText);
}

export function problemasNoTexto(texto: string): ProblemaDeTexto[] {
  const r: ProblemaDeTexto[] = [];
  const linhas = texto.split("\n");
  for (const [re, motivo] of PADROES) {
    for (const l of linhas) {
      if (re.test(l)) {
        r.push({ trecho: l.trim().slice(0, 120), motivo });
        break;
      }
    }
  }
  return r;
}

export type ProblemaDeLayout = { motivo: string; onde: string };

/**
 * Rolagem lateral (a página mais larga que 375) e texto cortado: elemento com reticências ou
 * com conteúdo maior que a caixa e overflow escondido, e elemento visível que sai pela direita.
 */
export async function problemasDeLayout(p: Page): Promise<ProblemaDeLayout[]> {
  return p.evaluate(() => {
    const r: { motivo: string; onde: string }[] = [];
    const largura = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > largura + 1) r.push({ motivo: `rolagem lateral (${document.documentElement.scrollWidth}px > ${largura}px)`, onde: "página" });
    const nome = (el: Element) => (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    const visivel = (el: Element) => {
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
      const b = el.getBoundingClientRect();
      return b.width > 1 && b.height > 1 && !el.classList.contains("sr-only");
    };
    // Dentro de um carrossel (rolagem de lado de propósito) não conta.
    const dentroDeRolagem = (el: Element) => {
      for (let e: Element | null = el.parentElement; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.overflowX === "auto" || s.overflowX === "scroll") return true;
      }
      return false;
    };
    // O campo em que ela está digitando não pode estar coberto (barra presa no rodapé etc.).
    const foco = document.activeElement;
    if (foco instanceof HTMLInputElement && visivel(foco)) {
      const b = foco.getBoundingClientRect();
      const x = b.left + b.width / 2;
      const y = b.top + b.height / 2;
      if (y > 0 && y < window.innerHeight) {
        const topo = document.elementFromPoint(x, y);
        if (topo && topo !== foco && !foco.contains(topo) && !topo.contains(foco) && !(foco.labels && Array.from(foco.labels).some((l) => l.contains(topo)))) {
          r.push({ motivo: "campo em uso coberto por outro elemento", onde: `${foco.getAttribute("aria-label") ?? foco.name ?? "campo"} sob "${nome(topo)}"` });
        }
      }
    }
    let cortados = 0;
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (cortados > 8) break;
      if (!(el instanceof HTMLElement) || !visivel(el)) continue;
      // As abas em roleta e os carrosséis rolam de lado de propósito.
      if (el.closest("[aria-hidden=true], svg, script, style, nextjs-portal, [data-roleta], [data-abas-presas] nav")) continue;
      const s = getComputedStyle(el);
      const temTextoProprio = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1);
      if (temTextoProprio && s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) {
        r.push({ motivo: "texto cortado com …", onde: nome(el) });
        cortados++;
        continue;
      }
      if (temTextoProprio && (s.overflow === "hidden" || s.overflowX === "hidden") && el.scrollWidth > el.clientWidth + 2 && s.whiteSpace === "nowrap") {
        r.push({ motivo: "texto maior que a caixa", onde: nome(el) });
        cortados++;
        continue;
      }
      if (temTextoProprio && !dentroDeRolagem(el)) {
        const b = el.getBoundingClientRect();
        if (b.right > largura + 1 && b.left < largura) {
          r.push({ motivo: `sai pela direita (${Math.round(b.right)}px)`, onde: nome(el) });
          cortados++;
        }
      }
    }
    return r;
  });
}
