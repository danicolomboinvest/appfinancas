import { describe, it, expect } from "vitest";
import { parsePortfolioStatement, guessAssetClass, detectFixedIncomeIndex } from "../portfolio-parser";

describe("detectFixedIncomeIndex", () => {
  it("reads the indexer from the rate text", () => {
    expect(detectFixedIncomeIndex("101,00% do CDI")).toBe("POS_FIXADO");
    expect(detectFixedIncomeIndex("SELIC + 0,14%")).toBe("POS_FIXADO");
    expect(detectFixedIncomeIndex("IPCA + 9,50%")).toBe("IPCA");
    expect(detectFixedIncomeIndex("13,20% a.a.")).toBe("PREFIXADO");
    expect(detectFixedIncomeIndex("")).toBeUndefined();
  });

  it("falls back to the Tesouro título name when the rate is missing", () => {
    expect(detectFixedIncomeIndex("", "LFT")).toBe("POS_FIXADO");
    expect(detectFixedIncomeIndex("", "LTN")).toBe("PREFIXADO");
    expect(detectFixedIncomeIndex("", "NTNB-P")).toBe("IPCA");
  });
});

describe("guessAssetClass", () => {
  it("infers class from ticker suffix", () => {
    expect(guessAssetClass("HGLG11")).toBe("FII");
    expect(guessAssetClass("PETR4")).toBe("ACAO");
    expect(guessAssetClass("ITUB3")).toBe("ACAO");
    expect(guessAssetClass("TSLA34")).toBe("ACAO"); // BDR termina em 34 → trata como ação
  });

  it("reconhece ticker internacional (letras, sem dígito) — extrato da Avenue e afins", () => {
    expect(guessAssetClass("VOO")).toBe("INTERNACIONAL");
    expect(guessAssetClass("AAPL")).toBe("INTERNACIONAL");
    expect(guessAssetClass("SCHD")).toBe("INTERNACIONAL");
    expect(guessAssetClass("O")).toBe("INTERNACIONAL"); // ticker de 1 letra existe (Realty Income)
  });
});

describe("parsePortfolioStatement", () => {
  it("parses a B3-style CSV with código/quantidade/valor", () => {
    const csv = `Código;Quantidade;Valor
PETR4;100;3.500,00
HGLG11;50;8.000,00`;
    const holdings = parsePortfolioStatement(csv);
    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toEqual({ ticker: "PETR4", quantity: 100, value: 3500 });
    expect(holdings[1]).toEqual({ ticker: "HGLG11", quantity: 50, value: 8000 });
  });

  it("parses loose text with tickers", () => {
    const text = `Minha carteira:
PETR4 100 acoes 3.500,00
KNRI11 30 cotas 4.200,00`;
    const holdings = parsePortfolioStatement(text);
    expect(holdings.map((h) => h.ticker)).toEqual(["PETR4", "KNRI11"]);
    expect(holdings[0].quantity).toBe(100);
  });

  it("merges repeated tickers (multiple buy lines)", () => {
    const csv = `Ticker;Quantidade;Valor
PETR4;100;3.500,00
PETR4;50;1.800,00`;
    const holdings = parsePortfolioStatement(csv);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(150);
    expect(holdings[0].value).toBe(5300);
  });

  it("ignores lines without a valid ticker", () => {
    const text = `Saldo em conta: 1.000,00\nPETR4 10 350,00`;
    const holdings = parsePortfolioStatement(text);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].ticker).toBe("PETR4");
  });

  it("parses a sectioned bank statement (BTG-style, US number format)", () => {
    // Recorte real (anonimizado) do "Extrato da Conta Investimento" do BTG: várias abas
    // concatenadas, tabelas por seção, números americanos e seções que devem ser ignoradas.
    const text = [
      ";Extrato da Conta Investimento;;;;",
      ";Fundos;;;;;;;;",
      ";Posições;;;;;;;;",
      ";Posição > Portfólio de fundos;;;;;;;;",
      ";Data Referência;Saldo Líquido R$ 30/06/26;Quantidade de Cotas;Cotação Atual R$;Saldo Bruto R$;Provisão de IR R$;Provisão de IOF R$;Saldo Líquido R$;Variação Nominal R$",
      ";BTG Yield DI FIRFRef CrPr - Classe CNPJ: 00.840.011/0001-80;;;;;;;;",
      ";10/07/2026;2,748.23;48.194989;57.51975625;2,772.16;14.60;-;2,757.56;9.33",
      ";Total em fundos;;;;2,772.16;14.60;-;2,757.56;9.33",
      ";Detalhamento;;;;;;;;",
      ";Detalhamento > BTG Yield DI FIRFRef CrPr;;;;;;;;",
      ";Data Compra;Quantidade de Cotas;Cotação Compra R$;Valor de Compra R$;Saldo Bruto R$;;;;",
      ";30/03/2026;48.194989;55.36259478;2,668.20;2,772.16;;;;",
      ";Renda Fixa;;;;;;;;",
      ";Posições;;;;;;;;",
      ";Posição > CRA;;;;;;;;",
      ";Emissor;Ativo;Emissão;Vencimento;Liquidez;Taxa Média Ponderada;Quantidade;Preço R$;Saldo Bruto R$",
      ";CERES;CRA-CRA0250038P;15/04/2025;15/07/2030;Não;110,00% do CDI;7;1078.193713;7,547.35",
      ";Total;;;;;;;;7,547.35",
      ";Posição > TESOURO DIRETO - LFT;;;;;;;;",
      ";Emissor;Ativo;Emissão;Vencimento;Liquidez;Taxa Média Ponderada;Quantidade;Preço R$;Saldo Bruto R$",
      ";BACEN;LFT;05/10/2022;01/03/2029;Não;SELIC + 0,14%;0.01;19379.93;193.79",
      ";Total;;;;;;;;193.79",
      ";Renda Variável;;;;;;;;",
      ";Posição;;;;;;;;",
      ";Posição > Ações;;;;;;;;",
      ";Código;Ação;Qtde.;Preço Fechamento R$;Preço Médio R$;Saldo Bruto R$;;;",
      ";ITSA4;ITAUSA      PN  N1;414;14.17;9.82;5,870.52;;;",
      ";Total em Ações R$;;;;;5,870.52;;;",
      ";Movimentação;;;;;;;;",
      ";Movimentação > Ações;;;;;;;;",
      ";Data;Transação;Código;Qtde.;Preço R$;Valor Bruto R$;;;",
      ";01/07/2026;JUROS S/CAPITAL;ITSA4;414;-;10.03;;;",
      ";Posição;;;;;;;;",
      ";Posição > Ações | Aluguel;;;;;;;;",
      ";Código;Qtde.;Posição;Preço de Referência R$;Valor Contratado R$;;;;",
      ";EGIE3;1;Doador;33.39;33.39;;;;",
      ";Posição;;;;;;;;",
      ";Posição > Fundos Listados;;;;;;;;",
      ";Código;Ativo;Tipo;Qtde.;Preço Fechamento R$;Preço Médio R$;Saldo Bruto R$;;",
      ";MXRF11;FII MAXI RENCI  ER;FII;1000;9.74;10.29;9,760.00;;",
      ";Total em Fundos Listados R$;;;;;;9,760.00;;",
    ].join("\n");

    const holdings = parsePortfolioStatement(text);
    const byName = new Map(holdings.map((h) => [h.ticker, h]));

    // Fundo com nome limpo (sem CNPJ), sem duplicar pelo Detalhamento
    expect(byName.get("BTG Yield DI FIRFRef CrPr")).toMatchObject({ quantity: 48.194989, value: 2772.16, assetClass: "FUNDO" });
    // Renda fixa com emissor legível
    expect(byName.get("CRA-CRA0250038P (CERES)")).toMatchObject({ quantity: 7, value: 7547.35, assetClass: "RENDA_FIXA" });
    // Tesouro identificado
    expect(byName.get("LFT")).toMatchObject({ quantity: 0.01, value: 193.79, assetClass: "TESOURO_DIRETO" });
    // Ação (número americano 5,870.52 → 5870.52), sem duplicar pela Movimentação
    expect(byName.get("ITSA4")).toMatchObject({ quantity: 414, value: 5870.52, assetClass: "ACAO" });
    // FII com classe vinda da coluna Tipo
    expect(byName.get("MXRF11")).toMatchObject({ quantity: 1000, value: 9760, assetClass: "FII" });
    // Aluguel de ações NÃO vira posição (evita duplicar/contar errado)
    expect(byName.has("EGIE3")).toBe(false);
    expect(holdings).toHaveLength(5);
  });

  it("parses a Planilha de Alocação (modelo próprio da Dani, preenchida à mão)", () => {
    // CSV real, exportado pela própria conversão xlsx→CSV do app a partir da planilha
    // original que a Dani distribui pras alunas preencherem (nomes/valores mantidos como
    // estão no arquivo real, só é a formatação mesmo — números em formato americano, célula
    // mesclada de "Classificação" só carrega o texto na primeira linha do grupo).
    const csv = [
      ";;;;;;;;Aportes; R$ 1,800.00 ;;",
      ";;;;;;;;;;;",
      "Classificação;Ativo;Invest. Inicial;Invest. mensal;Preço atual;Lucro/prejuízo;Carteira%;Perfil Moderado/Arrojado;Distribuição;Alocação;;Perfil de risco – Moderado, Busco crescimento patrimonial",
      "Renda Fixa - CDI;LCA 91% DO CDI; R$2,000.00 ; R$90.00 ; R$2,136.00 ; R$136.00 ;5.00%; R$90.00 ;5.00%;35%;;",
      "Renda Fixa - CDI;CDB DIGMAS 115% CDI; R$1,500.00 ; R$90.00 ; R$1,894.00 ; R$394.00 ;5.00%; R$90.00 ;5.00%;;;Estratégia",
      "Renda Fixa - CDI;FUNDO NUBANK; R$1,005.00 ; R$90.00 ; R$1,293.00 ; R$288.00 ;5.00%; R$90.00 ;5.00%;;;Curto prazo (até 3 anos) – CDB, IPCA 2029",
      "Renda Fixa - CDI;FUNDO DE INVEST. SICREDI; R$8,147.00 ; R$90.00 ; R$8,569.00 ; R$422.00 ;5.00%; R$90.00 ;5.00%;;;Médio prazo (de 5 à 10 anos) – LCA, IPCA 2032, FUNDO IMOBILIÁRIO",
      "Renda Fixa - CDI;LCA SICREDI 92% DO CDI; R$5,700.00 ; R$90.00 ; R$6,737.00 ; R$1,037.00 ;5.00%; R$90.00 ;5.00%;;;Longo prazo (+ de 10 anos) – AÇÕES, INVEST. NO EXTERIOR",
      "Renda Fixa - Inflação;IPCA 2032; R$1,988.00 ; R$90.00 ; R$2,010.00 ; R$22.00 ;5.00%; R$90.00 ;5.00%;;;",
      "Renda Fixa - Inflação;IPCA 2029; R$964.00 ; R$90.00 ; R$1,128.00 ; R$164.00 ;5.00%; R$90.00 ;5.00%;;;",
      "Imobiliário;KNCR11; R$1,372.00 ; R$60.00 ; R$1,403.00 ; R$31.00 ;3.33%; R$60.00 ;3.33%;10%;;",
      ";HGLG11; R$1,248.00 ; R$60.00 ; R$1,191.00 ;-R$57.00 ;3.33%; R$60.00 ;3.33%;;;",
      ";;; R$60.00 ;; R$-   ;3.33%; R$60.00 ;3.33%;;Não é uma prioridade;",
      "Ações Brasileiras;WEGE3; R$1,988.00 ; R$90.00 ; R$1,971.00 ;-R$17.00 ;5.00%; R$90.00 ;5.00%;15%;;",
      ";;; R$90.00 ;; R$-   ;5.00%; R$90.00 ;5.00%;;;Ações – objetivo: chegar em 30% da carteira",
      ";;; R$90.00 ;; R$-   ;5.00%; R$90.00 ;5.00%;;;Sendo 20% em ação brasileira e o restante em estrangeira.",
      "Exterior - Com Hedge;ETF - WESTERN ASSENT US INDEX; R$2,416.00 ; R$90.00 ; R$2,446.00 ; R$30.00 ;5.00%; R$90.00 ;5.00%;15%;ETF Gestão passiva - 500 maiores ações da bolsa americana. Com hedge;",
      ";ENCORE LONG BIAS CIC; R$2,000.00 ; R$90.00 ; R$1,838.00 ;-R$162.00 ;5.00%; R$90.00 ;5.00%;;ETF Gestão passiva - Sem hedge;",
      ";KAPITALO KAPPA ; R$500.00 ; R$90.00 ; R$496.00 ;-R$4.00 ;5.00%; R$90.00 ;5.00%;;Gestão ativa;https://maisretorno.com/fundo/manager-encore-long-bias-s-prev-fif-prev-cic-multimercado-previdenciario-rl",
      "Exterior - Sem Hedge;VOO; R$1,800.00 ; R$1,800.00 ;;;100.00%; R$150.00 ;8.33%;25%;;",
      ";;; R$150.00 ;;;8.33%; R$150.00 ;8.33%;;;",
      ";;; R$150.00 ;;;8.33%; R$150.00 ;8.33%;;;",
      ";; R$32,628.00 ;;; R$2,284.00 ;;;;;;",
      ";;;;;;;;;;;",
      ";; verificar se vale a pena manter ;;;;;;;;;",
      ";; pedi resgate ;;;;;;;;;",
      ";; buscar ativo p comprar ;;;;;;;;;",
      ";;;;;;;;;;;",
      "Ativo;Data de compra;Preço médio;;;;Quantidade;Total Investido;;;;",
      ";;;;;;;;;;;",
    ].join("\n");

    const holdings = parsePortfolioStatement(csv);
    const byName = new Map(holdings.map((h) => [h.ticker, h]));

    // 14 ativos de verdade: TOTAL, notas soltas e a segunda tabela (vazia) não entram.
    expect(holdings).toHaveLength(14);

    // Renda fixa: indexador lido do próprio nome do ativo, quando dá pra reconhecer.
    expect(byName.get("LCA 91% DO CDI")).toMatchObject({
      value: 2136,
      investedValue: 2000,
      assetClass: "RENDA_FIXA",
      fixedIncomeIndex: "POS_FIXADO",
    });
    expect(byName.get("CDB DIGMAS 115% CDI")).toMatchObject({ value: 1894, assetClass: "RENDA_FIXA", fixedIncomeIndex: "POS_FIXADO" });
    // Sem "CDI"/"IPCA" no nome: classe vem do grupo (herdada da célula mesclada), sem indexador.
    expect(byName.get("FUNDO NUBANK")).toMatchObject({ value: 1293, assetClass: "RENDA_FIXA", fixedIncomeIndex: undefined });
    expect(byName.get("FUNDO DE INVEST. SICREDI")).toMatchObject({ value: 8569, assetClass: "RENDA_FIXA" });
    expect(byName.get("LCA SICREDI 92% DO CDI")).toMatchObject({ value: 6737, assetClass: "RENDA_FIXA", fixedIncomeIndex: "POS_FIXADO" });

    // Novo grupo ("Renda Fixa - Inflação"): IPCA identificado pelo nome.
    expect(byName.get("IPCA 2032")).toMatchObject({ value: 2010, assetClass: "RENDA_FIXA", fixedIncomeIndex: "IPCA" });
    expect(byName.get("IPCA 2029")).toMatchObject({ value: 1128, assetClass: "RENDA_FIXA", fixedIncomeIndex: "IPCA" });

    // FIIs: HGLG11 herda "Imobiliário" da célula mesclada (linha sem texto na coluna Classificação).
    expect(byName.get("KNCR11")).toMatchObject({ value: 1403, assetClass: "FII" });
    expect(byName.get("HGLG11")).toMatchObject({ value: 1191, assetClass: "FII" }); // prejuízo (-R$57) não impede o parse

    // Ação brasileira.
    expect(byName.get("WEGE3")).toMatchObject({ value: 1971, assetClass: "ACAO" });

    // "Exterior - Com/Sem Hedge": ações/ETFs/fundos que investem fora do Brasil → INTERNACIONAL.
    expect(byName.get("ETF - WESTERN ASSENT US INDEX")).toMatchObject({ value: 2446, assetClass: "INTERNACIONAL" });
    expect(byName.get("ENCORE LONG BIAS CIC")).toMatchObject({ value: 1838, assetClass: "INTERNACIONAL" }); // herda o grupo, prejuízo
    expect(byName.get("KAPITALO KAPPA")).toMatchObject({ value: 496, assetClass: "INTERNACIONAL" }); // nome com espaço à direita, trimado

    // VOO: "Preço atual" em branco (aporte recém-feito) → cai pro valor investido, não zera.
    expect(byName.get("VOO")).toMatchObject({ value: 1800, investedValue: 1800, assetClass: "INTERNACIONAL" });

    // Nenhuma linha vira "quantidade" fantasma: a planilha só registra R$, não cotas.
    for (const h of holdings) expect(h.quantity).toBe(0);

    // Linha de TOTAL, anotações soltas e a segunda tabela (decoy, sem linhas de dados) ignoradas.
    expect(byName.has("")).toBe(false);
    expect(holdings.some((h) => h.ticker.includes("verificar"))).toBe(false);
  });
});
