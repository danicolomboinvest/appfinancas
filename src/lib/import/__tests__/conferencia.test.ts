import { describe, expect, it } from "vitest";
import { leituraIncompletaDoRegistro, MARCA_CONFERIDO, MARCA_NAO_FECHOU } from "@/lib/repositories/import-diagnostic.repo";
import { conferirLeitura, leituraIncompleta } from "../conferencia";
import type { ParsedTransaction } from "../statement-parser";

const t = (amount: number, description = "LOJA EXEMPLO"): ParsedTransaction => ({ date: "2026-09-10", description, amount });

/**
 * Em 29/09/2026, 10 dos 19 "erros" do e-mail diário eram leituras perfeitas: a fatura tinha
 * simulação de parcelamento e tabela de juros, o extrato repetia os Pix num quadro de
 * comprovantes — número que não é lançamento. A conferência é com o dinheiro, não com as linhas.
 */
describe("conferirLeitura: fatura", () => {
  it("bate com o total da fatura", () => {
    const conf = conferirLeitura("Total da fatura R$ 130,00", "fatura", [t(100), t(30)]);
    expect(conf.status).toBe("fechou");
  });

  it("bate com o total de COMPRAS quando o total a pagar mistura saldo anterior e pagamento (Ourocard)", () => {
    const texto = ["Saldo fatura anterior R$ 800,00", "Pagamentos/Créditos R$ -804,99", "Compras nacionais R$ 186,57", "Total da Fatura R$ 181,58"].join("\n");
    expect(conferirLeitura(texto, "fatura", [t(164), t(22.57), t(-4.99, "ESTORNO")]).status).toBe("fechou");
  });

  it("bate descontando o estorno", () => {
    expect(conferirLeitura("Total a pagar R$ 80,00", "fatura", [t(100), t(-20, "ESTORNO")]).status).toBe("fechou");
  });

  it("centavos de diferença ainda é bater", () => {
    expect(conferirLeitura("Total da fatura R$ 3.174,67", "fatura", [t(3174.73)]).status).toBe("fechou");
  });

  it("faltando compra de verdade, não fecha e diz quanto", () => {
    expect(conferirLeitura("Total da fatura R$ 7.590,00", "fatura", [t(5000)])).toEqual({ status: "nao-fechou", lido: 5000, esperado: 7590 });
  });

  it("fatura sem total impresso: não dá pra conferir", () => {
    expect(conferirLeitura("sem total nenhum", "fatura", [t(10)]).status).toBe("sem-referencia");
  });
});

describe("conferirLeitura: extrato", () => {
  it("confere com Total de entradas e Total de saídas quando o extrato traz (Cora)", () => {
    const texto = "Total de entradas \t+ R$ 1.100,00\nTotal de saídas \t- R$ 1.100,00";
    expect(conferirLeitura(texto, "extrato", [t(1000), t(100), t(-1000), t(-100)]).status).toBe("fechou");
    expect(conferirLeitura(texto, "extrato", [t(1000), t(-1000)]).status).toBe("nao-fechou");
  });

  it("sem os dois totais, não inventa referência (saldo muda de nome e sinal a cada banco)", () => {
    expect(conferirLeitura("Saldo anterior 10,00\nSaldo final 20,00", "extrato", [t(10)]).status).toBe("sem-referencia");
  });
});

describe("leituraIncompleta: a régua única", () => {
  it("bateu com o documento: nunca é incompleta, por mais linha com número que tenha", () => {
    expect(leituraIncompleta({ status: "fechou", lido: 1, esperado: 1 }, false, true)).toBe(false);
  });

  it("não bateu: é incompleta mesmo lendo quase todas as linhas", () => {
    expect(leituraIncompleta({ status: "nao-fechou", lido: 1, esperado: 2 }, true, false)).toBe(true);
  });

  it("sem total: leitor próprio do banco vale; o genérico segue a régua das linhas", () => {
    expect(leituraIncompleta({ status: "sem-referencia" }, true, true)).toBe(false);
    expect(leituraIncompleta({ status: "sem-referencia" }, false, true)).toBe(true);
    expect(leituraIncompleta({ status: "sem-referencia" }, false, false)).toBe(false);
  });
});

describe("leituraIncompletaDoRegistro: o que o relatório diário e o aviso de suporte leem", () => {
  const base = { ok: true, stage: "parse", moneyLines: 72, parsed: 23, message: null as string | null };

  it("a marca da conferência manda", () => {
    expect(leituraIncompletaDoRegistro({ ...base, message: `${MARCA_CONFERIDO} bateu com o total do arquivo` })).toBe(false);
    expect(leituraIncompletaDoRegistro({ ...base, moneyLines: 10, parsed: 10, message: `${MARCA_NAO_FECHOU} li 1, o arquivo diz 2` })).toBe(true);
  });

  it("registro antigo, sem marca, continua na régua das linhas", () => {
    expect(leituraIncompletaDoRegistro(base)).toBe(true);
    expect(leituraIncompletaDoRegistro({ ...base, parsed: 70 })).toBe(false);
  });

  it("falha e gravação não são leitura incompleta (têm conta própria)", () => {
    expect(leituraIncompletaDoRegistro({ ...base, ok: false })).toBe(false);
    expect(leituraIncompletaDoRegistro({ ...base, stage: "confirm" })).toBe(false);
  });
});
