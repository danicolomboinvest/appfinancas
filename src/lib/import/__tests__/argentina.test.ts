import { describe, expect, it } from "vitest";
import { installmentCanonical, parseInstallment } from "@/lib/entries/recurrence";
import { dataArgentinaNoInicio, numeroArgentino, pareceDaArgentina } from "../argentina";
import { isArgentinaCuenta } from "../argentina-cuenta-pdf";
import { comprasEmDolarDoResumen, isArgentinaTarjeta, parseArgentinaTarjeta, totalDoMesEmPesos } from "../argentina-tarjeta-pdf";
import { classifyDictionaryOnly } from "../classify";
import { conferirLeitura } from "../conferencia";
import { detectDocKind } from "../detect";
import { parecePagamentoDeFatura, pareceAplicacao, pareceResgate } from "../dinheiro-proprio";
import { isFaturaSummaryLine } from "../fatura-lines";
import { lerDatasDaFatura } from "../mes-da-compra";
import { parseStatementComLeitor, type ParsedTransaction } from "../statement-parser";
import { AMOSTRAS_DA_ARGENTINA, CAJA_DE_AHORRO, MERCADO_PAGO_LIBERACIONES, VISA_BBVA, VISA_PRISMA, type Amostra } from "./fixtures/argentina";

function ler(a: Amostra) {
  return parseStatementComLeitor(a.texto, a.csv ? "auto" : "pdf", 2026);
}

/** Quantas linhas esperadas a leitura acertou (data, valor no centavo e o pedaço da descrição). */
function acertos(a: Amostra, txns: ParsedTransaction[]): number {
  const sobra = [...txns];
  let ok = 0;
  for (const [data, valor, pedaco] of a.esperado) {
    const i = sobra.findIndex((t) => t.date === data && Math.abs(t.amount - valor) < 0.005 && t.description.toUpperCase().includes(pedaco.toUpperCase()));
    if (i >= 0) {
      ok += 1;
      sobra.splice(i, 1);
    }
  }
  return ok;
}

describe("Argentina: o básico", () => {
  it("datas nos jeitos de lá", () => {
    expect(dataArgentinaNoInicio("15/10/26 X", 2026)?.iso).toBe("2026-10-15");
    expect(dataArgentinaNoInicio("15-Oct-26 X", 2026)?.iso).toBe("2026-10-15");
    expect(dataArgentinaNoInicio("06-Ago-26", 2026)?.iso).toBe("2026-08-06");
    expect(dataArgentinaNoInicio("26 Setiem 26", 2026)?.iso).toBe("2026-09-26");
    expect(dataArgentinaNoInicio("04 SEP X", 2025)?.iso).toBe("2025-09-04");
    expect(dataArgentinaNoInicio("3 ene 2027", 2026)?.iso).toBe("2027-01-03");
    expect(dataArgentinaNoInicio("01 dic", 2026)?.iso).toBe("2026-12-01");
    // Palavra que começa com as letras de um mês não é mês.
    expect(dataArgentinaNoInicio("15 MARTINEZ 100,00", 2026)).toBeNull();
    expect(dataArgentinaNoInicio("10 MAYORISTA", 2026)).toBeNull();
  });

  it("números com $, U$S, menos depois e ponto decimal de CSV", () => {
    expect(numeroArgentino("$ 1.234,56")).toBe(1234.56);
    expect(numeroArgentino("1.234,56-")).toBe(-1234.56);
    expect(numeroArgentino("$-1.234,56")).toBe(-1234.56);
    expect(numeroArgentino("U$S 12,50")).toBe(12.5);
    expect(numeroArgentino("1234.56")).toBe(1234.56);
    expect(numeroArgentino("1.234.567")).toBe(1234567);
  });

  it("reconhece o documento de lá e não confunde com o do Brasil", () => {
    expect(pareceDaArgentina(VISA_PRISMA.texto)).toBe(true);
    expect(pareceDaArgentina(CAJA_DE_AHORRO.texto)).toBe(true);
    const brasil = "Extrato de conta corrente\nData Histórico Valor Saldo\n02/10/2026 PIX ENVIADO MERCADO 50,00 950,00\nA fatura fecha dia 3, vencimento dia 10";
    expect(pareceDaArgentina(brasil)).toBe(false);
    expect(isArgentinaTarjeta(brasil)).toBe(false);
    expect(isArgentinaCuenta(brasil)).toBe(false);
  });
});

describe("Argentina: cada layout", () => {
  for (const a of AMOSTRAS_DA_ARGENTINA) {
    it(`${a.nome}: lê todas as linhas (${a.fonte})`, () => {
      const { txns } = ler(a);
      expect(acertos(a, txns)).toBe(a.esperado.length);
      expect(txns).toHaveLength(a.esperado.length);
    });
  }

  it("diz o tipo certo de cada arquivo", () => {
    for (const a of AMOSTRAS_DA_ARGENTINA.filter((x) => !x.csv)) expect(detectDocKind(a.texto).kind, a.nome).toBe(a.tipo);
    expect(detectDocKind("Fecha;Descripción;Débito;Crédito;Saldo\n").kind).toBe("extrato");
    expect(detectDocKind("Fecha;Detalle;Cuota;Importe\n").kind).toBe("fatura");
  });

  it("usa o leitor da Argentina no PDF", () => {
    expect(ler(VISA_PRISMA).leitor).toBe("argentina-tarjeta");
    expect(ler(CAJA_DE_AHORRO).leitor).toBe("argentina-cuenta");
  });
});

describe("Argentina: fatura com peso e dólar", () => {
  it("lê só a coluna em pesos e deixa a compra em dólar de fora, sem misturar", () => {
    const txns = parseArgentinaTarjeta(VISA_PRISMA.texto, 2026);
    expect(txns.some((t) => /NETFLIX/.test(t.description))).toBe(false);
    expect(comprasEmDolarDoResumen(VISA_PRISMA.texto)).toBe(1);
    expect(txns.some((t) => /STEAM/.test(t.description))).toBe(false);
    expect(parseArgentinaTarjeta(VISA_BBVA.texto, 2026).some((t) => /STEAM/.test(t.description))).toBe(false);
  });

  it("o pagamento da anterior é linha de resumo; a soma do mês fecha com o saldo actual", () => {
    const txns = parseArgentinaTarjeta(VISA_PRISMA.texto, 2026);
    const pago = txns.find((t) => /SU PAGO/.test(t.description))!;
    expect(pago.amount).toBe(-512640.25);
    expect(isFaturaSummaryLine(pago)).toBe(true);
    expect(totalDoMesEmPesos(VISA_PRISMA.texto)).toBe(106917.37);
    const conf = conferirLeitura(VISA_PRISMA.texto, "fatura", txns.filter((t) => !isFaturaSummaryLine(t)));
    expect(conf.status).toBe("fechou");
  });

  it("não lê o quadro das cuotas a vencer como compra deste mês", () => {
    expect(parseArgentinaTarjeta(VISA_PRISMA.texto, 2026).filter((t) => /FRAVEGA/.test(t.description))).toHaveLength(1);
  });

  it("cierre e vencimiento do resumen", () => {
    expect(lerDatasDaFatura(VISA_PRISMA.texto)).toEqual({ vencimento: "2026-10-17", fechamento: "2026-10-07" });
    expect(lerDatasDaFatura(VISA_BBVA.texto)).toEqual({ vencimento: "2026-03-09", fechamento: "2026-02-26" });
  });
});

describe("Argentina: parcela (cuota)", () => {
  it("C.06/12, cta 04/06, Cuota 03/06 e CUOTA 06 DE 06 viram parcela com certeza", () => {
    expect(parseInstallment("FRAVEGA ONLINE C.06/12")).toEqual({ current: 6, total: 12, confident: true });
    expect(parseInstallment("GARBARINO cta 04/06")).toEqual({ current: 4, total: 6, confident: true });
    expect(parseInstallment("MUSIMUNDO Cuota 02/03")).toEqual({ current: 2, total: 3, confident: true });
    expect(parseInstallment("NOTEBOOK HOGAR CUOTA 06 DE 06")).toEqual({ current: 6, total: 6, confident: true });
    expect(installmentCanonical("FRAVEGA Cuota 06/12")).toBe("FRAVEGA Cuota 6/12");
  });

  it("o leitor escreve a parcela do jeito que o app entende", () => {
    const fravega = parseArgentinaTarjeta(VISA_PRISMA.texto, 2026).find((t) => /FRAVEGA/.test(t.description))!;
    expect(fravega.description).toBe("FRAVEGA ONLINE Cuota 06/12");
    expect(parseInstallment(fravega.description)).toEqual({ current: 6, total: 12, confident: true });
  });

  it("não muda a leitura brasileira", () => {
    expect(parseInstallment("POSTO SHELL 03/09")).toEqual({ current: 3, total: 9, confident: false });
    expect(parseInstallment("Parcela 2 de 6 - Notebook")).toEqual({ current: 2, total: 6, confident: true });
  });
});

describe("Argentina: categorias", () => {
  const cat = (d: string) => {
    const c = classifyDictionaryOnly(d, "PESSOAL");
    return c ? [c.parentCategory, c.subcategory ?? null] : null;
  };
  it("impostos e encargos da fatura e do extrato", () => {
    expect(cat("IMPUESTO DE SELLOS")).toEqual(["IMPOSTOS", null]);
    expect(cat("DB.IMPUESTO PAIS 30%")).toEqual(["IMPOSTOS", null]);
    expect(cat("PERCEP.AFIP RG 4815 35%")).toEqual(["IMPOSTOS", null]);
    expect(cat("DB.RG 5617 30%")).toEqual(["IMPOSTOS", null]);
    expect(cat("IVA RG 4240 21%")).toEqual(["IMPOSTOS", null]);
    expect(cat("IIBBA percep BSA 2%")).toEqual(["IMPOSTOS", null]);
    expect(cat("IMP. LEY 25413 DEB")).toEqual(["IMPOSTOS", null]);
    expect(cat("COMISION MANTENIMIENTO CUENTA")).toEqual(["OUTROS", "Tarifas bancárias"]);
    expect(cat("INTERESES FINANCIACION")).toEqual(["OUTROS", "Tarifas bancárias"]);
  });

  it("comerciantes comuns", () => {
    const casos: [string, string, string][] = [
      ["COTO SUC 145", "ALIMENTACAO", "Supermercado"],
      ["CARREFOUR MAXI 77", "ALIMENTACAO", "Supermercado"],
      ["DIA ARGENTINA SUC 554", "ALIMENTACAO", "Supermercado"],
      ["JUMBO PALERMO", "ALIMENTACAO", "Supermercado"],
      ["DISCO S.A. 123", "ALIMENTACAO", "Supermercado"],
      ["SUPERMERCADOS VEA", "ALIMENTACAO", "Supermercado"],
      ["LA ANONIMA 33", "ALIMENTACAO", "Supermercado"],
      ["YPF FULL 2231", "TRANSPORTE", "Combustível"],
      ["SHELL ACASSUSO", "TRANSPORTE", "Combustível"],
      ["AXION ENERGY", "TRANSPORTE", "Combustível"],
      ["PUMA ENERGY 44", "TRANSPORTE", "Combustível"],
      ["SUBE CARGA", "TRANSPORTE", "Transporte público"],
      ["CABIFY", "TRANSPORTE", "Aplicativo"],
      ["DIDI RIDES", "TRANSPORTE", "Aplicativo"],
      ["UBER *TRIP", "TRANSPORTE", "Aplicativo"],
      ["MERPAGO*PEDIDOSYA", "ALIMENTACAO", "Delivery"],
      ["RAPPI*RESTAURANTE", "ALIMENTACAO", "Delivery"],
      ["FARMACITY 0233", "SAUDE", "Farmácia"],
      ["TELECOM PERSONAL", "MORADIA", "Internet"],
      ["CLARO", "MORADIA", "Internet"],
      ["MOVISTAR", "MORADIA", "Internet"],
      ["EDENOR WEB", "MORADIA", "Luz"],
      ["EDESUR", "MORADIA", "Luz"],
      ["AYSA", "MORADIA", "Água"],
      ["METROGAS", "MORADIA", "Gás"],
      ["NATURGY BAN", "MORADIA", "Gás"],
      ["EXPENSAS EDIFICIO", "MORADIA", "Condomínio"],
      ["ALQUILER OCTUBRE", "MORADIA", "Aluguel"],
      ["NETFLIX.COM", "LAZER", "Streaming"],
      ["OSDE", "SAUDE", "Plano de saúde"],
    ];
    for (const [d, pai, sub] of casos) expect(cat(d), d).toEqual([pai, sub]);
  });

  it("os do Brasil continuam iguais (nome parecido não muda de categoria)", () => {
    expect(cat("SALDO DO DIA")).toBeNull();
    expect(cat("AUTO PECAS DISCO DE FREIO")).toEqual(["TRANSPORTE", "Manutenção do veículo"]);
    expect(cat("PUMA STORE SHOPPING")).toBeNull();
    expect(cat("PERSONAL TRAINER JOAO")).toBeNull();
    expect(cat("PIX ENVIADO IVA SILVA")).toBeNull();
    expect(cat("POSTO IPIRANGA")).toEqual(["TRANSPORTE", "Combustível"]);
    expect(cat("DROGASIL 123")).toEqual(["SAUDE", "Farmácia"]);
  });

  it("meio de pagamento não é comerciante", () => {
    expect(cat("TRANSFERENCIA RECIBIDA")).toBeNull();
    expect(cat("EXTRACCION CAJERO")).toBeNull();
  });
});

describe("Argentina: dinheiro que é dela", () => {
  it("pago de tarjeta no extrato é pagamento de fatura", () => {
    expect(parecePagamentoDeFatura("PAGO TARJETA VISA")).toBe(true);
    expect(parecePagamentoDeFatura("PAGO DE TARJETA DE CREDITO MASTERCARD")).toBe(true);
    expect(parecePagamentoDeFatura("PAGO DE SERVICIOS EDENOR")).toBe(false);
  });

  it("plazo fijo e FCI: aplicação; o vencimento do plazo fijo e o rescate: resgate", () => {
    expect(pareceAplicacao("CONSTITUCION PLAZO FIJO")).toBe(true);
    expect(pareceAplicacao("SUSCRIPCION FCI")).toBe(true);
    expect(pareceResgate("ACREDITACION PLAZO FIJO")).toBe(true);
    expect(pareceResgate("RESCATE FCI")).toBe(true);
    expect(pareceAplicacao("ACREDITACION PLAZO FIJO")).toBe(false);
  });
});

describe("Argentina: taxa de acerto nas amostras", () => {
  it("lê 100% das linhas esperadas", () => {
    let total = 0;
    let ok = 0;
    for (const a of AMOSTRAS_DA_ARGENTINA) {
      total += a.esperado.length;
      ok += acertos(a, ler(a).txns);
    }
    expect(MERCADO_PAGO_LIBERACIONES.esperado.length).toBeGreaterThan(0);
    expect(ok / total).toBe(1);
  });
});
