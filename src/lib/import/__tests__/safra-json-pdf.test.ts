import { describe, expect, it } from "vitest";
import { isSafraJsonPdf, parseSafraJsonPdf } from "../safra-json-pdf";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra fictícia: JSON do "Meus Dados" do Safra convertido em PDF, com marcador de página no meio.
const AMOSTRA = `Safra — Meus Dados: Conta Corrente e Cartões
Documento convertido a partir do arquivo JSON original.
{
"exportadoEm": "04-10-2026",
"extratos": {
"contaCorrente": {
"lancamentos": [
{
"data": "30-09-2026",
"descricao": "PIX RECEBIDO — FULANA EXEMPLO",
"tipo": "crédito",
"valor": 16.4
},
{
"data": "29-09-2026",
"descricao": "COMPRA MERCADO EXEMPLO",

-- 1 of 2 --

"tipo": "débito",
"valor": 52.1
},
{
"data": "29-09-2026",
"descricao": "Saldo disponível",
"tipo": "disponivel",
"valor": 809.75
}
]
},
"cartoes": {
"lancamentos": []
}
}
}

-- 2 of 2 --`;

describe("Safra Meus Dados (JSON em PDF)", () => {
  it("lê crédito como entrada, débito como saída e ignora o saldo do dia", () => {
    expect(isSafraJsonPdf(AMOSTRA)).toBe(true);
    expect(parseSafraJsonPdf(AMOSTRA)).toEqual([
      { date: "2026-09-30", description: "PIX RECEBIDO — FULANA EXEMPLO", amount: 16.4 },
      { date: "2026-09-29", description: "COMPRA MERCADO EXEMPLO", amount: -52.1 },
    ]);
  });

  it("entra no leitor geral", () => {
    expect(parseStatementComLeitor(AMOSTRA, "pdf", 2026).leitor).toBe("safra-json");
  });
});
