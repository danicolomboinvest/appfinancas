import { describe, expect, it } from "vitest";
import { parseIrpfBensEDireitos } from "../irpf-parser";

/**
 * Fixture SINTÉTICA que reproduz o layout que o `pdf-parse` (Node) produz para a "Declaração de
 * Bens e Direitos" do IRPF, tickers e valores inventados (nada de dados reais de ninguém).
 * Cada bloco cobre um formato real: custo médio explícito, custo por ação "R$:X", ação do
 * exterior (custo total), colisão do prefixo de grupo com "FUNDOS", posição vendida (2025 = 0),
 * número de conta terminando em "249" (não pode virar país 249/EUA) e um CDB (grupo fora do escopo).
 */
const SAMPLE = [
  "DECLARAÇÃO DE BENS E DIREITOS (Valores em Reais)",
  "GRUPO DISCRIMINAÇÃO SITUAÇÃO EM",
  "31/12/2024 31/12/2025",
  "CÓDIGO\tBEM",
  // Ação BR com ticker no texto e custo por ação.
  "03 TESTE ON NM - 100 ACOES TEST3 A UM CUSTO DE",
  "R$:10,00",
  "1.000,00 1.000,00",
  "CNPJ: 00.000.000/0001-00",
  "01\t1001",
  "105 - BRASIL",
  "Código de Negociação: TEST3\tNegociados em Bolsa: Sim",
  "Bem com usufruto: Não",
  // Ação BR só com nome (sem ticker) + conta EQI terminando em 249 (armadilha do país).
  "03 EQI - 004389249 - AÇÕES EXEMPLO PN N1 - 200 AÇÕES",
  "A UM CUSTO MÉDIO DE R$ 5,00",
  "900,00 1.000,00",
  "CNPJ: 00.000.000/0001-00",
  "01\t1002",
  "105 - BRASIL",
  "Código de Negociação: EXEM\tNegociados em Bolsa: Sim",
  "Bem com usufruto: Não",
  // Ação do exterior: custo é TOTAL; a linha de rendimento (12,00) não pode virar o custo.
  "03 AVENUE - ACOES FOOBAR INC - 4 ACOES A UM CUSTO DE AQUISICAO DE R$ 400,00",
  "400,00 400,00\t01\t1003",
  "249 - ESTADOS UNIDOS DA AMÉRICA",
  "Rendimento ou Perda: 12,00 Valor Recebido: 0,00",
  "Código de Negociação: FOO\tNegociados em Bolsa: Sim",
  "Bem com usufruto: Não",
  // FII com prefixo "07 FUNDOS ..." (o grupo 07 + FUNDOS não pode virar quantidade 7).
  "07 FUNDOS XP - FII TESTE ABCD11 CI - 500 QUOTAS A",
  "R$ 2,00 TOTAL R$ 1.000,00",
  "1.000,00 1.000,00",
  "CNPJ do Fundo: 00.000.000/0001-00",
  "03\t1004",
  "105 - BRASIL",
  "Código de Negociação: ABCD11\tNegociados em Bolsa: Sim",
  "Bem com usufruto: Não",
  // FII vendido no ano (situação 2025 = 0), não deve aparecer.
  "07 FUNDOS - FII VENDIDO WXYZ11 CI - 10 QUOTAS",
  "100,00 CADA TOTAL R$ 1.000,00",
  "1.000,00 0,00",
  "CNPJ do Fundo: 00.000.000/0001-00",
  "03\t1005",
  "105 - BRASIL",
  "Código de Negociação: WXYZ11\tNegociados em Bolsa: Sim",
  "Bem com usufruto: Não",
  // CDB (grupo 04), fora do escopo (não é negociado em bolsa, não tem preço médio de cota).
  "04 BTG - CDB BANCO XPTO",
  "0,00 5.000,00",
  "01\t1006",
  "105 - BRASIL",
  "Bem com usufruto: Não",
  // Quantidade com MILHAR ("1.000 QUOTAS" = mil, não um), regressão do bug que inflava o
  // investido 1000×. E a discriminação continua num texto com "31 DE DEZEMBRO" (não pode
  // abrir bloco falso) e um par "10 2024" solto (não pode virar o marcador código/nº-bem).
  "07 FUNDO IMOBILIÁRIO MILL11 - 1.000 QUOTAS A UM",
  "CUSTO MÉDIO DE R$ 10,29 COMPRADO EM 10 2024",
  "POSICAO EM 31 DE DEZEMBRO",
  "0,00 10.290,00",
  "CNPJ do Fundo: 00.000.000/0001-00",
  "03\t1007",
  "105 - BRASIL",
  "Código de Negociação: MILL11\tNegociados em Bolsa: Sim",
  "Bem com usufruto: Não",
].join("\n");

describe("parseIrpfBensEDireitos", () => {
  const assets = parseIrpfBensEDireitos(SAMPLE);
  const byTicker = (t: string) => assets.find((a) => a.ticker === t);
  const byName = (frag: string) => assets.find((a) => a.name.includes(frag));

  it("extrai só ações/FIIs/ETFs negociados em bolsa (ignora CDB e afins)", () => {
    // TEST3, EXEMPLO, FOO, ABCD11, MILL11, o CDB e o FII vendido ficam de fora.
    expect(assets).toHaveLength(5);
    expect(byName("CDB")).toBeUndefined();
  });

  it("lê quantidade com milhar ('1.000 QUOTAS' = mil) e ignora texto com datas soltas", () => {
    const a = byTicker("MILL11");
    expect(a?.quantity).toBe(1000); // e não 1 (que inflaria o investido 1000×)
    expect(a?.averagePrice).toBeCloseTo(10.29, 2);
  });

  it("calcula preço médio = custo ÷ quantidade para ação com ticker no texto", () => {
    const a = byTicker("TEST3");
    expect(a?.quantity).toBe(100);
    expect(a?.averagePrice).toBeCloseTo(10, 2);
    expect(a?.kind).toBe("acao");
  });

  it("lê o preço médio de ação só com nome (sem ticker na discriminação)", () => {
    const a = byName("EXEMPLO");
    expect(a?.ticker).toBeNull();
    expect(a?.quantity).toBe(200);
    expect(a?.averagePrice).toBeCloseTo(5, 2);
  });

  it("não confunde o fim do número da conta EQI (…249) com o país 249/EUA", () => {
    // Se lesse como exterior, o 'EXEM' (4 letras) viraria ticker pela regra de código estrangeiro.
    expect(byName("EXEMPLO")?.ticker).toBeNull();
  });

  it("ação do exterior: usa o custo de aquisição, não a linha de rendimento", () => {
    const a = byTicker("FOO");
    expect(a?.quantity).toBe(4);
    expect(a?.averagePrice).toBeCloseTo(100, 2); // 400 ÷ 4, e não 12 ÷ 4
  });

  it("não confunde o prefixo de grupo '07 FUNDOS' com a quantidade", () => {
    const a = byTicker("ABCD11");
    expect(a?.quantity).toBe(500); // e não 7
    expect(a?.averagePrice).toBeCloseTo(2, 2);
    expect(a?.kind).toBe("fii");
  });

  it("exclui posição vendida no ano (situação em 31/12 = 0)", () => {
    expect(byTicker("WXYZ11")).toBeUndefined();
  });
});
