import { describe, expect, it } from "vitest";
import { categoriaDoBancoParaOApp } from "../categoria-do-banco";
import { classify } from "../classify";
import { categoriaNaFrenteDaDescricao } from "../comerciante";
import { categoriaDaLinha } from "../motor";
import { completarPalavraCortada, descolarPalavraDeComida, pareceComida } from "../parece-comida";
import { porqueDaLinha, foiSeparada } from "../porque";
import { parseCsv } from "../statement-parser";

const linha = (descricao: string, categoriaDoBanco?: string, profileKind = "PESSOAL") =>
  categoriaDaLinha({ descricao, regras: [], profileKind, categoriaDoBanco, gasto: true });

/**
 * 12/10/2026, a Dani revisando as faturas do cartão EQI/BTG: "Costelão do gaúcho. É lógico que é
 * comida. [...] Sendo que estava escrito restaurante." Os nomes abaixo são os dela.
 */
describe("comida que vinha perguntada", () => {
  it("os nomes da fatura dela entram em Alimentação sem perguntar", () => {
    for (const nome of [
      "Costelao Do Gaucho",
      "Saint Claire Bakery",
      "Santa Clara Bakery",
      "Jesrestaurante",
      "Nanurestauran",
      "Oguru Itaim Restauran",
      "Gcc Comercio De Alime",
      "Battisti Battisti Alim",
      "Marcolini Alimentari",
      "Wrappd Alimento Sa",
      "Campania Ristorante",
      "Sal Gastronomia",
      "Nayme Culinaria Arabe",
      "Espetos Kodiak",
      "Pudim Perfeito",
      "Frutaria Curitiba",
      "Emporiotopmix",
      "Botecoritamaria",
    ]) {
      const r = linha(nome);
      expect(r.categoria?.parentCategory, nome).toBe("ALIMENTACAO");
      expect(r.motivo, nome).not.toBe("pergunta");
    }
  });

  it("subcategoria certa quando dá pra saber", () => {
    expect(classify("COSTELAO DO GAUCHO")?.subcategory).toBe("Restaurante");
    expect(classify("SANTA CLARA BAKERY")?.subcategory).toBe("Padaria");
    expect(classify("Oguru Itaim Restauran")?.subcategory).toBe("Restaurante");
    // "Comércio de alimentos" pode ser mercado ou restaurante: só a categoria-mãe.
    expect(classify("Gcc Comercio De Alime")).toEqual({ parentCategory: "ALIMENTACAO", subcategory: undefined });
  });

  it("palavra cortada só completa a ÚLTIMA palavra, e só tipo de comida com letras suficientes", () => {
    expect(completarPalavraCortada("oguru itaim restauran")).toBe("oguru itaim restaurante");
    expect(completarPalavraCortada("battisti alim")).toBe("battisti alimentos");
    expect(completarPalavraCortada("padaria pada")).toBe("padaria pada"); // "pada" pode ser nome
    expect(completarPalavraCortada("restau oguru")).toBe("restau oguru"); // não é a última
    expect(completarPalavraCortada("rest")).toBe("rest");
  });

  it("descola o tipo de lugar grudado no nome, sem quebrar o plural", () => {
    expect(descolarPalavraDeComida("jesrestaurante")).toBe("jes restaurante");
    expect(descolarPalavraDeComida("emporiotopmix sp")).toBe("emporio topmix sp");
    expect(descolarPalavraDeComida("restaurantes padarias")).toBe("restaurantes padarias");
  });
});

describe("sem falso positivo", () => {
  it("'gaúcho' sozinho não é comida", () => {
    expect(classify("GAUCHO PNEUS")?.parentCategory).toBe("TRANSPORTE"); // pneus
    expect(linha("GAUCHO MATERIAIS ELETRICOS").motivo).toBe("pergunta");
  });

  it("'bar' dentro de palavra continua não sendo bar", () => {
    expect(linha("BARBEARIA DO ZE").categoria?.parentCategory).not.toBe("ALIMENTACAO");
    expect(linha("BARRA SHOPPING ESTACIONAMENTO").categoria?.parentCategory).toBe("TRANSPORTE");
  });

  it("Novo Hamburgo cortado não é hamburgueria; juros do Pix no crédito não é a compra", () => {
    expect(classify("FARMACIA SAO JOAO NOVO HAMBURG")?.parentCategory).toBe("SAUDE");
    expect(classify("Juros de atraso do Pix no crédito para Mandacaru Gastronomia")?.parentCategory).toBe("OUTROS");
  });

  it("nome com cara de comida mas ramo de outra coisa não vira comida", () => {
    expect(linha("SABOR DE CASA IMOVEIS").motivo).toBe("pergunta");
    expect(linha("DOCE LAR MOVEIS").motivo).toBe("pergunta");
    expect(pareceComida("forno e cia eletro")).toBeNull();
  });

  it("'alim' só completa no fim; 'resta' não vira restaurante", () => {
    expect(classify("RESTA UM")).toBeNull();
  });
});

describe("sinal de segunda linha: parece comida", () => {
  it("entra separado com confiança média e o porquê à vista", () => {
    const r = linha("Sabor Da Terra");
    expect(r).toEqual({ categoria: { parentCategory: "ALIMENTACAO", subcategory: "Restaurante" }, motivo: "parece_comida", confianca: "media" });
    const tela = { ...r, category: "EXPENSE", parentCategory: "ALIMENTACAO", customCategoryId: null, autoClassified: true };
    expect(porqueDaLinha(tela)?.motivo).toBe("o nome parece de comida");
    expect(foiSeparada(tela)).toBe(true);
  });

  it("não vale em Pix: 'Paes' e 'Carneiro' são sobrenome", () => {
    expect(linha("Transferência enviada pelo Pix - Joao Doces Carne - •••.123.456-••").motivo).toBe("pergunta");
    expect(linha("Pix enviado Maria Paes").motivo).toBe("pergunta");
  });

  it("não vale na Empresa (lá Alimentação é mercadoria)", () => {
    expect(linha("Cozinha Da Vo", undefined, "EMPRESA").motivo).toBe("pergunta");
  });

  it("perde para o dicionário", () => {
    expect(linha("Doces E Cia Farmacia").categoria?.parentCategory).toBe("SAUDE");
  });
});

describe("o ramo que o banco escreveu no arquivo", () => {
  it("vira o motivo ramo_do_banco, com a subcategoria do dicionário quando ele concorda", () => {
    expect(linha("PAG*JOSEMARIA", "Restaurante / Lanchonete / Bar")).toEqual({
      categoria: { parentCategory: "ALIMENTACAO" },
      motivo: "ramo_do_banco",
      confianca: "alta",
    });
    expect(linha("MAZU RESTAURANTE", "RESTAURANTE").categoria).toEqual({ parentCategory: "ALIMENTACAO", subcategory: "Restaurante" });
    expect(linha("LOJA X", "COMERCIO DE ALIMENTOS").motivo).toBe("ramo_do_banco");
  });

  it("fica abaixo da regra dela e acima do dicionário", () => {
    const r = categoriaDaLinha({
      descricao: "COSTELAO DO GAUCHO",
      regras: [{ pattern: "costelao do gaucho", parentCategory: "LAZER" }],
      categoriaDoBanco: "restaurante",
      gasto: true,
    });
    expect(r.motivo).toBe("regra_sua");
    // O dicionário diria Combustível ("posto"); o banco sabe que é a lanchonete do posto.
    expect(linha("POSTO DO ZEQUINHA KM 12", "alimentação").categoria).toEqual({ parentCategory: "ALIMENTACAO" });
  });

  it("mapeia os ramos comuns e o MCC, não só comida", () => {
    expect(categoriaDoBancoParaOApp("Supermercados / Mercearia / Padarias / Lojas de Conveniência")).toBe("ALIMENTACAO");
    expect(categoriaDoBancoParaOApp("Comércio de alimentos")).toBe("ALIMENTACAO");
    expect(categoriaDoBancoParaOApp("Farmácias / Drogarias")).toBe("SAUDE");
    expect(categoriaDoBancoParaOApp("Posto de Gasolina")).toBe("TRANSPORTE");
    expect(categoriaDoBancoParaOApp("T&E Companhia aérea")).toBe("LAZER");
    expect(categoriaDoBancoParaOApp("5812")).toBe("ALIMENTACAO");
    expect(categoriaDoBancoParaOApp("MCC 5912")).toBe("SAUDE");
    expect(categoriaDoBancoParaOApp("5311")).toBeNull(); // loja de departamento: o app decide
    expect(categoriaDoBancoParaOApp("Departamento / Desconto")).toBeNull();
  });

  it("o '22h21 Alimentação' do extrato do BTG é lido como ramo", () => {
    expect(categoriaNaFrenteDaDescricao("22h21 Alimentação Compra no débito autorizada Mazu Restaurante")).toBe("alimentacao");
    expect(categoriaNaFrenteDaDescricao("Transporte Executivo Ltda")).toBeNull();
    // No Pix o BTG chuta: o Pix pra empresa de passagem de ônibus vinha como Lazer.
    expect(categoriaNaFrenteDaDescricao("09h12 Lazer e Entretenimento Pix enviado Bus Servicos De Agendamento S A")).toBeNull();
    expect(linha("09h12 Alimentação Compra no débito autorizada Pag*Fulano").motivo).toBe("ramo_do_banco");
  });

  it("a coluna Categoria do CSV (C6, Inter, Nubank) chega no motor", () => {
    const c6 = [
      "Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)",
      "10/09/2026;FULANA;1234;Restaurante / Lanchonete / Bar;PAG*JOSEMARIA;Única;0;0;87,50",
    ].join("\n");
    expect(parseCsv(c6, 2026)[0]).toMatchObject({ description: "PAG*JOSEMARIA", categoriaDoBanco: "Restaurante / Lanchonete / Bar" });
    const nubank = ["date,category,title,amount", "2026-09-10,restaurante,Costelao Do Gaucho,120.00"].join("\n");
    expect(parseCsv(nubank, 2026)[0]).toMatchObject({ description: "Costelao Do Gaucho", categoriaDoBanco: "restaurante" });
    const semColuna = ["data;descricao;valor", "10/09/2026;LOJA;-10,00"].join("\n");
    expect(parseCsv(semColuna, 2026)[0].categoriaDoBanco).toBeUndefined();
  });
});
