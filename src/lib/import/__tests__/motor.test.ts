import { describe, expect, it } from "vitest";
import { chaveDoComerciante } from "../comerciante";
import { categoriaDaLinha, respostaParaOGrupo, type CategoriaDaLinha } from "../motor";
import { filaPorComerciante, iguaisPraAplicar, type LinhaDaRevisao } from "../revisao-em-grupo";
import type { LearnedRule } from "../classify";
import { DESCRICOES_DE_EXTRATO } from "./fixtures/descricoes-de-extrato";

const motor = (descricao: string, regras: LearnedRule[] = [], profileKind?: string) => categoriaDaLinha({ descricao, regras, profileKind, gasto: true });

describe("motor: perguntar só o difícil", () => {
  const resultados = DESCRICOES_DE_EXTRATO.map((caso) => ({ caso, r: motor(caso.descricao) }));
  const separadas = resultados.filter((x) => x.r.confianca === "alta");

  it("pelo menos 90% de uma lista realista de extrato (Nubank, Itaú, Inter, Bradesco, BTG, C6) entra sem pergunta", () => {
    // Antes (dicionário de 03/10/2026, sem a comunidade de agora): 104 de 152, 68%.
    expect(separadas.length / resultados.length).toBeGreaterThanOrEqual(0.9);
  });

  it("o que entra sozinho entra certo (no máximo 2 divergências, as duas decididas pela comunidade)", () => {
    const erradas = separadas.filter((x) => x.r.categoria?.parentCategory !== x.caso.esperado);
    expect(erradas.length).toBeLessThanOrEqual(2);
    for (const e of erradas) expect(e.r.motivo, e.caso.descricao).toBe("comunidade");
  });

  it("o que é difícil de verdade continua pergunta: Pix pra pessoa, loja que vende de tudo, maquininha sem nome", () => {
    for (const x of resultados.filter((r) => r.caso.esperado === null)) {
      expect(x.r, x.caso.descricao).toEqual({ categoria: null, motivo: "pergunta", confianca: "baixa" });
    }
  });

  it("os casos que a Dani reclamou entram separados", () => {
    for (const d of ["Manychat", "Openai *Chatgpt Subscr", "Aze Sushi", "Restaurante De Ville", "Vsg Mercados", "Super Festval", "Supermercados De Angel", "Mity Sushi Interna"]) {
      expect(motor(d).confianca, d).toBe("alta");
    }
  });
});

describe("motor: a ordem das camadas", () => {
  it("a regra dela vem antes de tudo, inclusive com a categoria que ela criou", () => {
    const regras: LearnedRule[] = [{ pattern: "manychat", parentCategory: "OUTROS", customCategoryId: "dani-invest" }];
    expect(motor("EBN*MANYCHAT SAO PAULO BR", regras)).toEqual({
      categoria: { parentCategory: "OUTROS", customCategoryId: "dani-invest" },
      motivo: "regra_sua",
      confianca: "alta",
    });
  });

  it("a comunidade (alta confiança) vem antes do dicionário", () => {
    // Na base versionada, "cacau show" tem 79% de Lazer (presente); o dicionário diria Alimentação.
    expect(motor("CACAU SHOW").motivo).toBe("comunidade");
  });

  it("personalizada apagada cai na categoria-mãe de reserva", () => {
    const regras: LearnedRule[] = [{ pattern: "manychat", parentCategory: "OUTROS", customCategoryId: "apagada" }];
    const r = categoriaDaLinha({ descricao: "Manychat", regras, gasto: true, personalizadas: new Set(["outra"]) });
    expect(r.categoria).toEqual({ parentCategory: "OUTROS" });
  });

  it("estorno é devolução, aplicação é investimento", () => {
    expect(categoriaDaLinha({ descricao: "Estorno Ifood", regras: [], gasto: false, estorno: true }).motivo).toBe("devolucao");
    expect(categoriaDaLinha({ descricao: "Aplicação RDB", regras: [], gasto: true, investimento: true }).motivo).toBe("investimento");
  });

  it("no perfil Empresa, ferramenta é Estrutura › Software e anúncio é Marketing › Anúncios", () => {
    expect(motor("Manychat", [], "EMPRESA").categoria).toEqual({ parentCategory: "MORADIA", subcategory: "Software e assinaturas" });
    expect(motor("META ADS", [], "EMPRESA").categoria).toEqual({ parentCategory: "EDUCACAO", subcategory: "Anúncios" });
    expect(motor("FACEBK *ABCD1234", [], "EMPRESA").categoria).toEqual({ parentCategory: "EDUCACAO", subcategory: "Anúncios" });
  });
});

describe("aprender de verdade", () => {
  const MANYCHATS = ["Manychat", "MANYCHAT.COM", "EBN*MANYCHAT SAO PAULO BR", "Compra no débito - MANYCHAT INC", "COMPRA CARTAO MANYCHAT 12/05"];

  it("o mesmo comerciante escrito de cinco jeitos tem a mesma chave", () => {
    expect(new Set(MANYCHATS.map(chaveDoComerciante))).toEqual(new Set(["manychat"]));
  });

  it("no mesmo lote: responder uma linha resolve todas as do mesmo comerciante (mesmo de outro arquivo do lote)", () => {
    const linhas = MANYCHATS.map((descricao) => ({ descricao, resultado: { categoria: null, motivo: "pergunta", confianca: "baixa" } as CategoriaDaLinha }));
    const depois = respostaParaOGrupo(linhas, 0, { parentCategory: "OUTROS", customCategoryId: "dani-invest" });
    expect(depois[0].resultado.motivo).toBe("regra_sua");
    for (const l of depois.slice(1)) expect(l.resultado).toEqual({ categoria: { parentCategory: "OUTROS", customCategoryId: "dani-invest" }, motivo: "mesmo_nome", confianca: "alta" });
  });

  it("na tela: uma pergunta por comerciante ('ManyChat aparece 3 vezes'), e a resposta vale pro grupo", () => {
    const linha = (key: number, description: string): LinhaDaRevisao => ({ key, description, category: "EXPENSE", parentCategory: null, customCategoryId: null, autoClassified: false, profileId: null });
    const items = [linha(0, "Manychat"), linha(1, "Ifd*Loja X"), linha(2, "MANYCHAT.COM"), linha(3, "EBN*MANYCHAT SAO PAULO BR"), linha(4, "Pix enviado Ana Ficticia")];
    const fila = filaPorComerciante(items);
    expect(fila.keys).toEqual([0, 1, 4]);
    expect(fila.vezes.get(0)).toBe(3);
    expect(iguaisPraAplicar(items, 0)).toEqual([2, 3]);
  });

  it("no lote seguinte: a regra gravada pela chave já classifica, sem pergunta", () => {
    const regra: LearnedRule = { pattern: chaveDoComerciante("Manychat"), parentCategory: "OUTROS", customCategoryId: "dani-invest" };
    for (const d of MANYCHATS) {
      const r = motor(d, [regra]);
      expect(r.motivo, d).toBe("regra_sua");
      expect(r.categoria?.customCategoryId, d).toBe("dani-invest");
    }
  });

  it("regra pelo começo do nome: 'anthropic' vale para 'Anthropic Claude Sub', mas 'uber eats' não pega 'uber'", () => {
    const regras: LearnedRule[] = [
      { pattern: "anthropic", parentCategory: "EDUCACAO" },
      { pattern: "uber eats", parentCategory: "ALIMENTACAO" },
    ];
    expect(motor("Anthropic Claude Sub", regras).categoria?.parentCategory).toBe("EDUCACAO");
    expect(motor("UBER *TRIP", regras).motivo).not.toBe("regra_sua");
  });

  it("as regras antigas (descrição quase inteira) continuam valendo", () => {
    const antiga: LearnedRule = { pattern: "transferencia enviada pelo ricardo romero colombo itau unibanco s a agencia conta", parentCategory: "MORADIA" };
    const d = "Transferência enviada pelo Pix - Ricardo Romero Colombo - •••.143.577-•• - ITAÚ UNIBANCO S.A. (0341) Agência: 879 Conta: 12622-5";
    expect(motor(d, [antiga]).motivo).toBe("regra_sua");
  });
});
