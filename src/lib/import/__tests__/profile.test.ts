import { describe, expect, it } from "vitest";
import { profileDocument } from "../profile";

describe("profileDocument lê o arquivo inteiro antes de decidir", () => {
  it("extrato da conta investimento (BTG/EQI): posição + movimentações, não é barrado como extrato", () => {
    const text = [
      ";;Extrato da Conta Investimento;;",
      ";;Período de 01/09/26 a 17/09/26;;",
      ";;Banco: BTG Pactual;;",
      ";Posição > Ações;;;;;;;;",
      ";Código;Ação;Qtde.;Preço Fechamento R$;Preço Médio R$;Saldo Bruto R$;;;",
      ";ABCB4*;ABC BRASIL  PN      N2;16;24.66;19.64;392.96;;;",
      ";WEGE3*;WEG         ON      NM;10;51.28;35.14;509.40;;;",
      ";Total em Ações R$;;;;;902.36;;;",
      ";Conta Corrente;;;;",
      ";Movimentações;;;;",
      ";Data;Descrição;Movimentação R$;Saldo conta investimentos R$",
      ";02/09/2026;DIVIDENDOS - À VISTA s/ FLEURY - FLRY3;5.99;297.38",
      ";15/09/2026;RENDIMENTOS - À VISTA s/ FII HGLG11;2.34;300.83",
      ";;ouvidoria@eqi.com.br",
    ].join("\n");
    const p = profileDocument(text, "CFNetworkDownload_eJ0wui.xlsx");
    expect(p.kind).toBe("position");
    expect(p.contents).toEqual(expect.arrayContaining(["position", "movements"]));
    expect(p.institution).toBe("BTG Pactual");
    expect(p.period).toEqual({ from: "01/09/2026", to: "17/09/2026" });
    expect(p.positionRows).toBe(2);
    expect(p.movementRows).toBe(2);
    expect(p.summary).toBe("Extrato de investimentos (posição + movimentações) · BTG Pactual · 01/09 a 17/09/2026");
  });

  it("extrato bancário do Nubank (CSV) é extrato, com banco e período das datas", () => {
    const text = [
      "Data,Valor,Identificador,Descrição",
      "01/09/2026,1200.00,abc,Transferência recebida pelo Pix - JOAO - NU PAGAMENTOS",
      "03/09/2026,-250.00,def,Compra no débito - MERCADO",
      "10/09/2026,-80.50,ghi,Pagamento de fatura",
    ].join("\n");
    const p = profileDocument(text, "NU_123_01SET2026_17SET2026.csv");
    expect(p.kind).toBe("statement");
    expect(p.institution).toBe("Nubank");
    expect(p.period).toEqual({ from: "01/09/2026", to: "10/09/2026" });
    expect(p.summary).toBe("Extrato bancário · Nubank · 01/09 a 10/09/2026");
  });

  it("fatura de cartão (texto) é fatura mesmo sem cabeçalho na primeira linha", () => {
    const text = ["C6 Bank", "Vencimento 10/10/2026", "Limite disponível R$ 1.000,00", "12/09/2026 IFOOD *IFD 45,90", "13/09/2026 UBER *TRIP 18,50", "Total da fatura R$ 64,40"].join("\n");
    const p = profileDocument(text, "arquivo.pdf");
    expect(p.kind).toBe("invoice");
    expect(p.institution).toBe("C6 Bank");
    expect(p.summary).toContain("Fatura de cartão · C6 Bank");
  });

  it("OFX de cartão é fatura pelo tipo declarado", () => {
    const text = ["<OFX><CREDITCARDMSGSRSV1><CCSTMTRS>", "<STMTTRN><DTPOSTED>20260901<TRNAMT>-45.90<MEMO>IFOOD</STMTTRN>", "</CCSTMTRS></CREDITCARDMSGSRSV1></OFX>"].join("\n");
    expect(profileDocument(text, "fatura.ofx").kind).toBe("invoice");
  });

  it("declaração do IRPF (bens e direitos) é IRPF, não posição", () => {
    const text = ["Declaração de Ajuste Anual", "Bens e Direitos", "Discriminação: 100 AÇÕES PETR4 - PETROBRAS PN", "Situação em 31/12/2025: 3.200,00"].join("\n");
    expect(profileDocument(text).kind).toBe("irpf");
  });

  it("relatório de posição da B3 (CSV) é posição, sem movimentações", () => {
    const text = ["Código;Produto;Quantidade;Preço de Fechamento;Valor Atualizado", "ITUB4;ITAUSA PN;200;42,73;8.546,00", "MXRF11;FII MAXI RENDA;500;9,11;4.555,00"].join("\n");
    const p = profileDocument(text, "posicao-b3.csv");
    expect(p.kind).toBe("position");
    expect(p.movementRows).toBe(0);
    expect(p.summary).toBe("Posição da carteira");
  });

  it("extrato do Nubank em PDF: banco pelo que mais aparece (não pelo 'BTG' de uma transferência), datas por extenso", () => {
    const text = [
      "NU PAGAMENTOS S.A.",
      "01 DE MAIO DE 2026 14 DE SETEMBRO DE 2026 VALORES EM R$",
      "Saldo inicial", "Total de entradas", "Total de saídas",
      "02 MAI 2026", "Transferência enviada pelo Pix - BTG Pactual", "-1.000,00", "Saldo do dia", "385,73",
      "10 SET 2026", "Transferência recebida pelo Pix - NU PAGAMENTOS", "500,00",
    ].join("\n");
    const p = profileDocument(text, "6560d9c3-2026-05-01-2026-09-14.pdf");
    expect(p.kind).toBe("statement");
    expect(p.institution).toBe("Nubank");
    expect(p.period).toEqual({ from: "01/05/2026", to: "14/09/2026" });
  });

  it("planilha de ETFs de fora (ticker só com letras) é posição quando a coluna se chama Ticker", () => {
    const text = ["Ticker;Tipo;% na Renda Variável;Valor (USD)", "VOO;S&P 500;0.25;700.8", "QQQ;Tech (Nasdaq 100);0.15;420.48", "SHV;Curto prazo;0.4;747.52"].join("\n");
    const p = profileDocument(text, "Carteira_ETFs.xlsx");
    expect(p.positionRows).toBe(3);
    expect(p.kind).toBe("position");
  });

  it("texto sem sinais fica como não reconhecido, sem inventar", () => {
    const p = profileDocument("olá\nisto é um recibo de padaria\n12,00");
    expect(p.kind).toBe("unknown");
    expect(p.summary).toBe("Arquivo que não reconheci");
  });
});
