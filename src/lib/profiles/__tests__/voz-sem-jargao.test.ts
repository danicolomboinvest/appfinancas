import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROFILE_THEMES } from "../themes";
import { vozDoTema, type Titulos } from "../voice";
import { PADRAO_FOCO } from "../textos/foco";

/**
 * O Padrão é o tema que já vem marcado, e quase todo mundo fica nele. A revisão de set/2026 achou
 * "Aporte" no primeiro formulário, "realizado × planejado" no Foco e "Marcação a mercado" no
 * Decidir, e textos fixos nos componentes que furavam a voz do Girly no meio da tela. Estes
 * testes seguram as duas coisas: o texto do dia a dia sem jargão, e os componentes lendo da voz.
 */

/** Palavras de investidor ou de planilha que a iniciante não entende. */
const JARGAO = /aport|provento|patrim[oô]nio|rentabilidade|ac[uú]mulo|consolidad|proje[cç][aã]o|realizado|indexador|ipca|marca[cç][aã]o a mercado|amortiz|comprometid/i;

/** Qualquer valor da voz vira texto: função é chamada com argumentos de exemplo, objeto vira a
 * lista dos valores. Os argumentos misturam texto e número, como no teste de jargão do Girly. */
function texto(v: unknown): string {
  if (typeof v === "function") return String((v as (...a: unknown[]) => unknown)("Mercado", "R$ 10", 3));
  if (v && typeof v === "object") return Object.values(v).map(texto).join(" | ");
  return String(v);
}

/** As chaves das telas do dia a dia: o formulário do +, a lista do mês, o Foco e seus avisos, o
 * Decidir, o "Posso comprar?", o Raio-X e a barra de baixo. */
const DIA_A_DIA = /^(aviso|compra|dec|raiox|formLanc|navAbaMes|uiTipo|uiRenda|uiAporteSemDestino|uiFixo|focoMetaP|focoRitmo|fechAporte|formOrcRendaEAporte|formOrcEditarPlano|formOrcBarra)/;

describe("o Padrão sem jargão nas telas do dia a dia", () => {
  const p = vozDoTema("padrao").titulos;

  it("nenhuma chave do dia a dia fala como investidor", () => {
    const chaves = Object.keys(p).filter((k) => DIA_A_DIA.test(k));
    expect(chaves.length).toBeGreaterThan(80);
    for (const chave of chaves) {
      expect(texto(p[chave as keyof Titulos]), chave).not.toMatch(JARGAO);
    }
  });

  it("guardar no lugar de aporte, e o combinado no lugar de realizado × planejado", () => {
    expect([p.uiTipoRenda, p.uiTipoGasto, p.uiTipoAporte]).toEqual(["Renda", "Gasto", "Guardado"]);
    expect(p.uiRendaFatiaAportes).toBe("Guardado");
    expect(p.uiFixoApagarTitulo("INVESTMENT_CONTRIBUTION")).toBe("Apagar dinheiro guardado todo mês");
    expect(p.focoMetaP("R$ 300")).toBe("Para voltar ao prazo, precisa guardar R$ 300 por mês.");
    expect(p.focoRitmoMensalSub).toBe("15 minutos no fechamento: o que aconteceu × o que você combinou.");
    expect(p.fechAporteEy).not.toMatch(/aporte/i);
  });

  it("todo tema que não escreveu a própria versão herda o texto limpo", () => {
    // Nenhum tema sobrescreve o tipo do lançamento, a não ser o Girly ("Guardou"): os outros
    // cinco mostravam "Aporte" no formulário do +.
    for (const t of PROFILE_THEMES) {
      if (t.key === "girly") continue;
      expect(vozDoTema(t.key).titulos.uiTipoAporte, t.key).toBe("Guardado");
      expect(vozDoTema(t.key).titulos.navAbaMes, t.key).toBe("Meu mês");
    }
  });

  it("\"Indexador\" e \"IPCA+\" ficam só na Carteira, com o que cada um quer dizer do lado", () => {
    expect(p.formAtivoIndexador).toMatch(/como ele rende/i);
    expect(p.formAtivoIndexadores.POS_FIXADO).toMatch(/caixinha/i);
    expect(p.formAtivoIndexadores.IPCA).toMatch(/infla[cç][aã]o/i);
    // Fora do formulário de investimento, ninguém lê essas palavras.
    for (const chave of Object.keys(p).filter((k) => !k.startsWith("formAtivo") && !k.startsWith("cart") && !k.startsWith("sim"))) {
      expect(texto(p[chave as keyof Titulos]), chave).not.toMatch(/indexador|ipca\+/i);
    }
  });

  it("o Decidir pergunta como gente, não como mercado financeiro", () => {
    expect(p.decPerguntas.marcacao).not.toMatch(/marca[cç][aã]o/i);
    expect(p.decPerguntas.amortizar).not.toMatch(/amortiz/i);
    // As perguntas do dia a dia continuam as de antes.
    expect(p.decPerguntas.gastando).toBe("Estou gastando demais?");
    expect(p.decPerguntas.comprar).toBe("Posso comprar isso?");
  });
});

describe("o Girly nos textos que moravam fixos nos componentes", () => {
  const g = vozDoTema("girly").titulos;
  const p = vozDoTema("padrao").titulos;

  it("diz combinado, sonho e guardei, nunca plano, orçamento, meta ou aplicação", () => {
    const chaves = Object.keys(g).filter((k) => /^(aviso|compra|dec|raiox|formLanc|navAbaMes)/.test(k));
    expect(chaves.length).toBeGreaterThan(80);
    for (const chave of chaves) {
      expect(texto(g[chave as keyof Titulos]), chave).not.toMatch(/\bplano\b|or[cç]amento|aplica[cç][aã]o|\bmetas?\b|comprometid/i);
    }
  });

  it("escreve a versão dela, com emoji, nos botões que ela mais toca", () => {
    for (const chave of ["avisoPontualT", "avisoNadaMaisT", "avisoMetaAjustarT", "avisoEntendiT", "compraVouComprar", "navAbaMes"] as const) {
      expect(g[chave], chave).not.toBe(p[chave]);
      expect(g[chave], chave).toMatch(/\p{Extended_Pictographic}/u);
    }
    expect(g.decPerguntas.meta).toBe("Quando chego no meu sonho? ✨");
    expect(g.avisoRodapePlano("R$ 10")).toBe("Combinado R$ 10");
  });

  it("toda pergunta do Decidir tem a versão dela", () => {
    for (const [chave, pergunta] of Object.entries(g.decPerguntas)) {
      expect(pergunta, chave).not.toBe(PADRAO_FOCO.decPerguntas[chave as keyof typeof PADRAO_FOCO.decPerguntas]);
    }
  });
});

describe("os componentes leem da voz, não escrevem o texto", () => {
  const ler = (arquivo: string) => readFileSync(arquivo, "utf8");

  it("a janela dos avisos do Foco", () => {
    const f = ler("src/app/(app)/mensal/foco/AvisoFoco.tsx");
    for (const fixo of ['"Já transferi"', '"Vou transferir essa semana"', '"Foi pontual"', "acima do plano em", "É aplicação (guardei", '"Ajustar a meta"', "Você combinou\n", '"Prazo passou"']) {
      expect(f, fixo).not.toContain(fixo);
    }
  });

  it("o Decidir, o \"Posso comprar?\" e o Raio-X", () => {
    const decidir = ler("src/app/(app)/decidir/page.tsx");
    // Nenhuma pergunta escrita no arquivo (`t: "..."`), nem os títulos das seções.
    expect(decidir).not.toMatch(/\bt: "/);
    for (const fixo of [">No dia a dia<", ">Decisões grandes<"]) {
      expect(decidir, fixo).not.toContain(fixo);
    }
    const compra = ler("src/app/(app)/decidir/comprar/PossoComprar.tsx");
    for (const fixo of ["comprometida", "(regra das 24 horas)", "Rendimento de referência", "em valor de hoje", ">\n                Vou comprar"]) {
      expect(compra, fixo).not.toContain(fixo);
    }
    expect(ler("src/app/(app)/decidir/raio-x/RaioX.tsx")).not.toContain("Rendimento de referência");
  });

  it("a barra de baixo e o formulário do +", () => {
    const barra = ler("src/components/shell/MobileTabBar.tsx");
    expect(barra).toContain("voz.titulos.navAbaMes");
    expect(barra).toContain("voz.titulos.navMais");
    const campos = ler("src/components/forms/CategoryFields.tsx");
    for (const fixo of ["O que é\n", '"Nome da nova categoria"', "Usadas recentemente:", '"Que tipo de gasto é?"']) {
      expect(campos, fixo).not.toContain(fixo);
    }
  });
});
