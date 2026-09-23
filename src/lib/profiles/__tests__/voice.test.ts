import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROFILE_THEMES } from "../themes";
import { estadoDoMes, vozDoTema, type Estado, type Money, type SituacaoOrcamento } from "../voice";

const money: Money = (n, o) => (o?.round ? `R$ ${Math.round(n).toLocaleString("pt-BR")}` : `R$ ${n.toFixed(2)}`);
const ESTADOS: Estado[] = ["bom", "normal", "ruim", "vazio"];
const SITUACOES: SituacaoOrcamento[] = ["sem-plano", "folgado", "no-ritmo", "adiantado", "estourou"];

describe("estado do mês", () => {
  it("é a avaliação que vem antes de qualquer frase", () => {
    expect(estadoDoMes({ income: 0, expense: 0, investment: 0 })).toBe("vazio");
    // Sobrou 44% do que entrou: bom.
    expect(estadoDoMes({ income: 21514, expense: 6276 + 5728, investment: 0 })).toBe("bom");
    // Sobrou 6%: normal.
    expect(estadoDoMes({ income: 20000, expense: 18760, investment: 0 })).toBe("normal");
    // Gastou mais do que entrou: ruim.
    expect(estadoDoMes({ income: 5000, expense: 5840, investment: 0 })).toBe("ruim");
    // Nada entrou e algo saiu: ruim, não normal.
    expect(estadoDoMes({ income: 0, expense: 300, investment: 0 })).toBe("ruim");
  });

  it("aporte conta como guardado, não como gasto", () => {
    // Entrou 10.000, gastou 8.500, aportou 1.500: sobrou 15% pra poupança. Normal, não ruim.
    expect(estadoDoMes({ income: 10000, expense: 8500, investment: 1500 })).toBe("normal");
  });
});

describe("a voz dos sete temas", () => {
  const dados = (resultado: number) => ({ resultado, income: 21514, expense: 6276, money });

  it("todo tema responde em todo estado e em toda situação de orçamento, sem estourar", () => {
    for (const t of PROFILE_THEMES) {
      const voz = vozDoTema(t.key);
      for (const estado of ESTADOS) {
        const f = voz.fraseResultado(estado, dados(estado === "ruim" ? -840 : 9510));
        expect(f === null || (typeof f === "string" && f.length > 0), `${t.label}/${estado}`).toBe(true);
        expect(() => voz.rodape(estado)).not.toThrow();
      }
      for (const situacao of SITUACOES) {
        const f = voz.fraseOrcamento({ situacao, restante: 1024, porDia: 93, diasRestantes: 11, ultimoDia: 30, money });
        expect(f.length, `${t.label}/${situacao}`).toBeGreaterThan(10);
        // Mês fechado: sem "por dia" pra frente, nenhum tema pode inventar um.
        const fechado = voz.fraseOrcamento({ situacao, restante: 1024, porDia: null, diasRestantes: 0, ultimoDia: 30, money });
        expect(fechado, `${t.label}/${situacao}/fechado`).not.toMatch(/por dia/);
      }
      expect(voz.mesVazio.length).toBeGreaterThan(10);
      expect(voz.metaBatida("Viagem Europa").length).toBeGreaterThan(3);
      expect(voz.nav.flowTabs).toHaveLength(3);
      expect(["manha", "tarde", "noite"].every((p) => voz.saudacao(p as never, "Dani") !== undefined)).toBe(true);
    }
  });

  /**
   * A regra dela, e vale pros sete: a cobrança fala do número, nunca da pessoa. Na coluna
   * ruim nenhum tema pode usar adjetivo sobre quem está lendo — nem o Sem filtro.
   */
  it("na coluna ruim ninguém xinga a pessoa", () => {
    const proibidas = [/você é/i, /péssim/i, /irrespons/i, /burr/i, /pregui/i, /fracass/i, /incompet/i, /vergonh/i, /desastr/i];
    for (const t of PROFILE_THEMES) {
      const voz = vozDoTema(t.key);
      const frases = [
        voz.fraseResultado("ruim", dados(-840)) ?? "",
        voz.fraseResultado("ruim", { ...dados(-840), mesFechado: true }) ?? "",
        voz.fraseOrcamento({ situacao: "estourou", restante: 400, porDia: 93, diasRestantes: 11, ultimoDia: 30, money }),
        voz.ritmo.rapido,
        voz.rodape("ruim") ?? "",
        voz.mesVazio,
      ];
      for (const f of frases) for (const re of proibidas) expect(f, `${t.label}: "${f}"`).not.toMatch(re);
    }
  });

  /** "É pouco? Sim" só pode aparecer quando é pouco de verdade — foi o furo que ela apontou. */
  it("o Disciplina só diz 'é pouco' quando está apertado", () => {
    const voz = vozDoTema("disciplina");
    const base = { restante: 1024, porDia: 93, diasRestantes: 11, ultimoDia: 30, money };
    expect(voz.fraseOrcamento({ ...base, situacao: "adiantado" })).toContain("É pouco? Sim");
    expect(voz.fraseOrcamento({ ...base, situacao: "folgado", porDia: 290 })).not.toContain("É pouco");
    expect(voz.fraseOrcamento({ ...base, situacao: "no-ritmo" })).not.toContain("É pouco");
  });

  /** O Padrão continua como é hoje: as frases são as MESMAS que os componentes já mostravam. */
  it("o Padrão usa as frases exatas que o app já tinha", () => {
    const voz = vozDoTema("padrao");
    const flow = readFileSync("src/app/(app)/mensal/[year]/[month]/FlowIndicators.tsx", "utf8");
    const page = readFileSync("src/app/(app)/mensal/[year]/[month]/page.tsx", "utf8");
    // As frases de ritmo e o texto do mês vazio saíram dos componentes pra cá: os arquivos
    // não podem mais ter uma cópia própria, senão vira duas fontes da mesma frase.
    expect(flow).not.toContain("Gastando rápido demais");
    expect(page).not.toContain("Nenhum lançamento neste mês ainda");
    expect(voz.ritmo).toEqual({ rapido: "Gastando rápido demais", limite: "No limite do ritmo", dentro: "Dentro do ritmo" });
    expect(voz.rotuloResultado).toBe("Resultado");
    expect(voz.saudacao("manha", "Dani")).toBe("Bom dia, Dani.");
    expect(voz.fraseResultado("bom", dados(9510))).toBeNull();
    expect(voz.fraseOrcamento({ situacao: "no-ritmo", restante: 1024, porDia: 93, diasRestantes: 11, ultimoDia: 30, money })).toBe(
      "Sobram R$ 1.024 para 11 dias: R$ 93 por dia até dia 30.",
    );
  });

  it("os nomes de navegação são os do desenho", () => {
    expect(vozDoTema("disciplina").nav.metas).toBe("Metas");
    expect(vozDoTema("game").nav.metas).toBe("Missões");
    expect(vozDoTema("manifestacao").nav.metas).toBe("Sonhos");
    expect(vozDoTema("girly").nav.metas).toBe("Sonhos");
    expect(vozDoTema("disciplina").nav.flowTabs).toEqual(["Resultado", "Gastos", "Plano"]);
  });

  /** O Girly fala com a pessoa nos títulos também — e o Padrão continua com os de hoje. */
  it("os títulos do Girly têm voz, os do Padrão são os de sempre", () => {
    const g = vozDoTema("girly").titulos;
    const p = vozDoTema("padrao").titulos;
    expect(p.categoriaEstourou).toBe("Categoria que mais estourou");
    expect(p.visaoGeral).toBe("Visão Geral");
    expect(g.categoriaEstourou).not.toBe(p.categoriaEstourou);
    expect(g.nenhumaEstourou).toContain("amiga");
    expect(g.sobrouNoAnoDica("R$ 100", "R$ 31", 31)).toContain("Orgulho");
    expect(g.sobrouNoAnoDica("R$ 100", "R$ 0", 0)).not.toContain("Orgulho");
    // Mesmo elogiando, nada de adjetivo negativo sobre a pessoa em lugar nenhum.
    for (const v of Object.values(g)) {
      const texto = typeof v === "function" ? (v as (...a: never[]) => unknown)(...(["10%", "R$ 10", 10] as never[])) : v;
      expect(String(texto)).not.toMatch(/péssim|irrespons|preguiç|burr/i);
    }
  });

  /** A Dani: "é uma menina — linguagem simples e bem de garota, pra ela entender tudo". */
  it("o Girly não usa jargão de finanças nos títulos", () => {
    const g = vozDoTema("girly").titulos;
    const p = vozDoTema("padrao").titulos;
    const jargao = /aport|provento|patrim[oô]nio|rentabilidade|ac[uú]mulo|consolidado|proje[cç][aã]o/i;
    // Só o que o Girly ESCREVEU: o que ele herda do Padrão (catálogo ainda sem versão dele)
    // não é voz do Girly, é ausência dela — e o teste seguinte cobra que ela apareça.
    for (const [chave, v] of Object.entries(g)) {
      if (v === p[chave as keyof typeof p]) continue;
      const texto = typeof v === "function" ? (v as (...a: never[]) => unknown)(...(["10%", "R$ 10", 10] as never[])) : v;
      expect(String(texto), chave).not.toMatch(jargao);
    }
    expect(g.aportou).toBe("Guardou pra investir 🐷");
    // O tom que ela pediu: "me dá R$ 300 pra eu chegar lá", como uma amiga escreveria.
    expect(g.metaGuardar("R$ 300")).toBe("Me dá R$ 300 esse mês e a gente chega lá 💪✨");
    expect(g.metaAporteFeito("setembro")).toContain("Boaaaa");
    expect(g.apJuros).not.toMatch(/põem/);
    expect(vozDoTema("padrao").titulos.aportou).toBe("Aportou");
  });

  it("o Game não cumprimenta: abre no ranking", () => {
    expect(vozDoTema("game").saudacao("manha", "Dani")).toBeNull();
    expect(vozDoTema("girly").saudacao("manha", "Dani")).toBe("Oii, Dani 💕");
    expect(vozDoTema("semfiltro").subSaudacao("Setembro")).toBe("Bora ver o estrago de setembro.");
  });
});

describe("Sem filtro: a tirada de cada categoria varia com o mês", () => {
  const sf = vozDoTema("semfiltro");
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  it("é a mesma frase pra mesma entrada (não pula a cada abertura)", () => {
    expect(sf.titulos.comparacao("mais", "R$ 92", "agosto", "ALIMENTACAO")).toBe(sf.titulos.comparacao("mais", "R$ 92", "agosto", "ALIMENTACAO"));
  });

  it("ao longo do ano, cada categoria mostra as três variações", () => {
    for (const cat of ["ALIMENTACAO", "MORADIA", "TRANSPORTE", "LAZER", "SAUDE", "EDUCACAO", "IMPOSTOS", "OUTROS"]) {
      for (const tipo of ["mais", "menos"] as const) {
        const frases = new Set(meses.map((m) => sf.titulos.comparacao(tipo, "R$ 10", m, cat).split(". ").slice(1).join(". ")));
        expect(frases.size, `${cat}/${tipo}`).toBe(3);
      }
    }
  });

  it("categoria personalizada cai na frase neutra", () => {
    expect(sf.titulos.comparacao("mais", "R$ 10", "agosto")).toBe("R$ 10 a mais que agosto. Foi mal, foi? 🫣");
    expect(sf.titulos.comparacao("menos", "R$ 10", "agosto", undefined)).toContain("Olha ela economizando");
  });
});
