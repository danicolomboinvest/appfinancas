/**
 * Amostras SINTÉTICAS de extratos e faturas argentinos (14/10/2026). Nomes, números de cartão,
 * comprovantes e valores são inventados; nenhum dado de pessoa real. O FORMATO de cada uma segue
 * o que uma fonte pública mostra (citada em cima de cada amostra). Onde a fonte não mostrou um
 * detalhe, o comentário diz que é suposição.
 *
 * `esperado` é o que um leitor perfeito devolveria: [data, valor, pedaço da descrição].
 * Compra positiva, pagamento/crédito negativo (fatura); entrada positiva, saída negativa (extrato).
 */

export type Amostra = {
  nome: string;
  fonte: string;
  tipo: "fatura" | "extrato";
  csv?: true;
  texto: string;
  esperado: [string, number, string][];
};

const M = "−"; // o menos tipográfico que o PDF da Visa usa nas datas e no sinal.

/**
 * Visa (Prisma) de banco: colunas "FECHA COMPROBANTE DETALLE DE TRANSACCION CUOTA PESOS DOLARES",
 * data dd−mm−aa com U+2212, cuota "C.06/12", crédito com o menos DEPOIS, IVA com base e imposto
 * (vale o último), rótulos SALDO ANTERIOR / SU PAGO / CIERRE ACTUAL / VENCIMIENTO ACTUAL / SALDO
 * ACTUAL $ / SALDO ACTUAL U$S / CUOTAS A VENCER.
 * Fonte: github.com/NicoPelos/resumen-dashboard (parser do index.html, Visa Credicoop).
 */
export const VISA_PRISMA: Amostra = {
  nome: "Visa (Prisma)",
  fonte: "github.com/NicoPelos/resumen-dashboard",
  tipo: "fatura",
  texto: [
    "VISA",
    "RESUMEN DE CUENTA - TARJETA VISA",
    "TITULAR: PERSONA DE PRUEBA   CUIT 20-00000000-0",
    "CIERRE ACTUAL: 07 Oct 26",
    "VENCIMIENTO ACTUAL: 17 Oct 26",
    "PROXIMO VTO.: 16 Nov 26",
    "SALDO ACTUAL $: 106.917,37",
    "SALDO ACTUAL U$S: 9,99",
    "PAGO MINIMO ACTUAL $: 25.000,00",
    "LIMITE DE COMPRA $ 2.000.000,00",
    "FECHA\tCOMPROBANTE\tDETALLE DE TRANSACCION\tCUOTA\tPESOS\tDOLARES",
    "SALDO ANTERIOR\t512.640,25",
    `SU PAGO EN PESOS\t512.640,25${M}`,
    `12${M}09${M}26\tCOTO SUC 145\t004512 *\t45.320,10`,
    `14${M}04${M}26\tFRAVEGA ONLINE\tC.06/12\t004513 *\t18.500,00`,
    `20${M}09${M}26\tYPF FULL 2231\t004530 K\t32.000,00`,
    `22${M}09${M}26\tMERPAGO*PEDIDOSYA\t004531 *\t12.450,50`,
    `25${M}09${M}26\tNETFLIX.COM USD 9,99\t004540 *\t9,99`,
    `28${M}09${M}26\tDEVOLUCION FALABELLA\t004541 *\t5.000,00${M}`,
    `07${M}10${M}26\tIVA RG 4240 21%\t10.000,00\t2.100,00`,
    "IMPUESTO DE SELLOS $\t1.546,77",
    "TOTAL CONSUMOS DE PERSONA DE PRUEBA\t111.917,37",
    "CUOTAS A VENCER",
    "Noviembre/26 $ 18.500,00",
    `12${M}11${M}26\tFRAVEGA ONLINE\tC.07/12\t004513 *\t18.500,00`,
  ].join("\n"),
  esperado: [
    // O pagamento sem data entra com a data do fechamento, como linha de resumo.
    ["2026-10-07", -512640.25, "SU PAGO EN PESOS"],
    ["2026-09-12", 45320.1, "COTO"],
    ["2026-04-14", 18500, "FRAVEGA"],
    ["2026-09-20", 32000, "YPF"],
    ["2026-09-22", 12450.5, "PEDIDOSYA"],
    ["2026-09-28", -5000, "DEVOLUCION FALABELLA"],
    ["2026-10-07", 2100, "IVA RG 4240"],
    ["2026-10-07", 1546.77, "IMPUESTO DE SELLOS"],
  ],
};

/**
 * Cabal: "FECHA COMPROBANTE DETALLE PESOS DOLARES", data dd/mm/aa, comprovante ANTES do
 * detalhe, cuota dentro do detalhe como "cta 04/06".
 * Fonte: github.com/NicoPelos/resumen-dashboard (Cabal Credicoop).
 */
export const CABAL: Amostra = {
  nome: "Cabal",
  fonte: "github.com/NicoPelos/resumen-dashboard",
  tipo: "fatura",
  texto: [
    "CABAL - RESUMEN DE TARJETA",
    "CIERRE ACTUAL 02/10/26",
    "VENCIMIENTO ACTUAL 14/10/26",
    "SALDO ACTUAL $ 61.230,00",
    "PAGO MINIMO $ 9.000,00",
    "FECHA\tCOMPROBANTE\tDETALLE\tPESOS\tDOLARES",
    "SALDO ANTERIOR 40.000,00",
    "SU PAGO EN PESOS 40.000,00-",
    "05/09/26\t223344\tFARMACITY 0233\t8.730,00",
    "10/05/26\t223345\tGARBARINO cta 05/06\t15.000,00",
    "18/09/26\t223346\tCARREFOUR MAXI 77\t37.500,00",
  ].join("\n"),
  esperado: [
    ["2026-10-02", -40000, "SU PAGO EN PESOS"],
    ["2026-09-05", 8730, "FARMACITY"],
    ["2026-05-10", 15000, "GARBARINO"],
    ["2026-09-18", 37500, "CARREFOUR"],
  ],
};

/**
 * Visa do BBVA: data "06-Feb-26", percepção "DB.RG 5617 30% ( 27966,01 ) 8.389,80" (a base entre
 * parênteses, o imposto no fim), ajuste com o menos ANTES, "IMPUESTO DE SELLOS $" sem data.
 * Fonte: trecho de um resumen BBVA citado em es.scribd.com/document/1052936464 (só o trecho do
 * buscador); o resto do layout (cabeçalho e rótulos) é suposição, igual ao Visa acima.
 */
export const VISA_BBVA: Amostra = {
  nome: "Visa BBVA",
  fonte: "es.scribd.com/document/1052936464 (trecho)",
  tipo: "fatura",
  texto: [
    "BBVA - Resumen de tarjeta VISA",
    "CIERRE ACTUAL 26-Feb-26   VENCIMIENTO ACTUAL 09-Mar-26",
    "SALDO ACTUAL $ 63.411,72",
    "PAGO MINIMO $ 10.000,00",
    "FECHA COMPROBANTE DETALLE DE TRANSACCION PESOS DOLARES",
    "03-Feb-26 000111 * STEAM PURCHASE USD 30,00 30,00",
    "06-Feb-26 DB.RG 5617 30% ( 27966,01 ) 8.389,80",
    "06-Feb-26 DB.RG 5617 30% M (M) -8.662,66",
    "11-Feb-26 000112 * JUMBO PALERMO 52.138,81",
    "IMPUESTO DE SELLOS $ 7.546,77",
    "15-Feb-26 000113 * DIDI RIDES 3.999,00",
  ].join("\n"),
  esperado: [
    ["2026-02-06", 8389.8, "DB.RG 5617"],
    ["2026-02-06", -8662.66, "DB.RG 5617"],
    ["2026-02-11", 52138.81, "JUMBO"],
    ["2026-02-11", 7546.77, "IMPUESTO DE SELLOS"],
    ["2026-02-15", 3999, "DIDI"],
  ],
};

/**
 * American Express: colunas fecha, comprobante, detalle, cuotas, importe; data "04 SEP" sem ano,
 * cuota "02/03", desconto com o "-" depois do valor, "Cierre Anterior".
 * Fonte: ikiwi.net.ar/tarjetas/credito/como-sacar-leer-resumen/ (descrição em texto) e
 * github.com/damiiraola/cifra/pull/27 ("04 SEP", "CUOTA 3/6"). Layout exato: suposição.
 */
export const AMEX: Amostra = {
  nome: "American Express",
  fonte: "ikiwi.net.ar + github.com/damiiraola/cifra/pull/27",
  tipo: "fatura",
  texto: [
    "AMERICAN EXPRESS - Resumen de tarjeta",
    "Cierre Anterior 04 Sep 26   Cierre Actual 02 Oct 26",
    "Vencimiento Actual 14 Oct 26",
    "Pago Mínimo $ 12.000,00",
    "Fecha Comprobante Detalle Cuotas Importe",
    "04 SEP 778899 SHELL ACASSUSO 21.300,00",
    "12 AGO 778900 MUSIMUNDO 02/03 40.000,00",
    "19 SEP 778901 RAPPI*RESTAURANTE 9.870,40",
    "20 SEP 778902 BONIFICACION ANUAL 3.000,00-",
  ].join("\n"),
  esperado: [
    ["2026-09-04", 21300, "SHELL"],
    ["2026-08-12", 40000, "MUSIMUNDO"],
    ["2026-09-19", 9870.4, "RAPPI"],
    ["2026-09-20", -3000, "BONIFICACION"],
  ],
};

/**
 * Naranja X: "Pago del resumen anterior FECHA DETALLE $ U$S" e a linha "PAGO EN PESOS" (não "SU
 * PAGO"), datas dd/mm/aa. Fonte: es.scribd.com/document/698482556 (resumen 2023). O resto é
 * suposição.
 */
export const NARANJA_X: Amostra = {
  nome: "Naranja X",
  fonte: "es.scribd.com/document/698482556",
  tipo: "fatura",
  texto: [
    "Naranja X - Resumen de tarjeta",
    "Cierre actual 28/09/26",
    "Vencimiento actual 10/10/26",
    "Total a pagar $ 30.600,00",
    "Pago mínimo $ 4.000,00",
    "Pago del resumen anterior",
    "FECHA DETALLE $ U$S",
    "07/09/26 PAGO EN PESOS 72.668,81",
    "Consumos del período",
    "FECHA DETALLE $ U$S",
    "03/09/26 SUBE CARGA 5.000,00",
    "12/09/26 DIA ARGENTINA SUC 554 25.600,00",
  ].join("\n"),
  esperado: [
    ["2026-09-07", -72668.81, "PAGO EN PESOS"],
    ["2026-09-03", 5000, "SUBE"],
    ["2026-09-12", 25600, "DIA ARGENTINA"],
  ],
};

/**
 * Mastercard do Santander: data dd/mm/aa e a parcela "CUOTA 06 DE 06".
 * Fonte: github.com/damiiraola/cifra/pull/27 (PDFs de teste SINTÉTICOS do próprio repo, ou seja,
 * evidência fraca). Rótulos: suposição.
 */
export const MASTER_SANTANDER: Amostra = {
  nome: "Mastercard Santander",
  fonte: "github.com/damiiraola/cifra/pull/27",
  tipo: "fatura",
  texto: [
    "Santander - Resumen de tarjeta Mastercard",
    "Cierre actual 25/09/26  Vencimiento actual 06/10/26",
    "Saldo actual $ 89.900,00",
    "Pago mínimo $ 9.000,00",
    "Fecha Comprobante Detalle Cuota Pesos Dólares",
    "15/04/26 551100 NOTEBOOK HOGAR CUOTA 06 DE 06 50.000,00",
    "02/09/26 551101 EDENOR WEB 39.900,00",
  ].join("\n"),
  esperado: [
    ["2026-04-15", 50000, "NOTEBOOK"],
    ["2026-09-02", 39900, "EDENOR"],
  ],
};

/**
 * Extrato de caja de ahorro em PDF. NENHUM banco argentino publica o layout do extrato (a pesquisa
 * não achou fonte); este é o molde genérico "FECHA CONCEPTO DEBITO CREDITO SALDO" com o saldo
 * depois de cada linha, que é o que o leitor exige. As palavras (COMPRA DEBITO, TRANSFERENCIA
 * RECIBIDA, IMP. LEY 25413, EXTRACCION) são as do dia a dia de lá; a lei 25.413 é a do imposto.
 */
export const CAJA_DE_AHORRO: Amostra = {
  nome: "Caja de ahorro (genérico)",
  fonte: "suposição (sem fonte pública de layout)",
  tipo: "extrato",
  texto: [
    "Resumen de cuenta - Caja de Ahorro en Pesos",
    "CBU 0000000000000000000000",
    "Movimientos del 01/10/2026 al 10/10/2026",
    "Fecha\tConcepto\tDébito\tCrédito\tSaldo",
    "01/10/26\tSALDO ANTERIOR\t\t\t150.000,00",
    "02/10/26\tCOMPRA DEBITO COTO SUC 45\t12.345,67\t\t137.654,33",
    "03/10/26\tTRANSFERENCIA RECIBIDA PERSONA PRUEBA\t\t80.000,00\t217.654,33",
    "03/10/26\tIMP. LEY 25413 DEB\t74,07\t\t217.580,26",
    "05/10/26\tDEB. AUTOMATICO METROGAS\t9.880,26\t\t207.700,00",
    "06/10/26\tEXTRACCION CAJERO\t20.000,00\t\t187.700,00",
    "08/10/26\tACREDITACION HABERES\t\t850.000,00\t1.037.700,00",
    "09/10/26\tPAGO TARJETA VISA\t106.917,37\t\t930.782,63",
  ].join("\n"),
  esperado: [
    ["2026-10-02", -12345.67, "COTO"],
    ["2026-10-03", 80000, "TRANSFERENCIA RECIBIDA"],
    ["2026-10-03", -74.07, "LEY 25413"],
    ["2026-10-05", -9880.26, "METROGAS"],
    ["2026-10-06", -20000, "EXTRACCION"],
    ["2026-10-08", 850000, "HABERES"],
    ["2026-10-09", -106917.37, "PAGO TARJETA"],
  ],
};

/**
 * CSV de movimentos em espanhol (Fecha;Descripción;Débito;Crédito;Saldo). Os bancos não publicam
 * as colunas (o CSV do Galicia existe, github.com/filotti/galicia-parser, mas sem colunas
 * documentadas): suposição pelo padrão comum.
 */
export const CSV_MOVIMIENTOS: Amostra = {
  nome: "CSV de movimientos (genérico)",
  fonte: "suposição (github.com/filotti/galicia-parser confirma só que o CSV existe)",
  tipo: "extrato",
  csv: true,
  texto: [
    "Fecha;Descripción;Débito;Crédito;Saldo",
    "01/10/2026;SALDO AL INICIO;;;10.000,00",
    "02/10/2026;Compra con tarjeta de débito FARMACITY;3.450,50;;6.549,50",
    "03/10/2026;Transferencia recibida;;25.000,00;31.549,50",
    "04/10/2026;Débito automático PERSONAL FLOW;8.999,00;;22.550,50",
  ].join("\n"),
  esperado: [
    ["2026-10-02", -3450.5, "FARMACITY"],
    ["2026-10-03", 25000, "Transferencia recibida"],
    ["2026-10-04", -8999, "PERSONAL FLOW"],
  ],
};

/**
 * Relatório de dinheiro liberado do Mercado Pago (Argentina): colunas DATE, SOURCE_ID,
 * EXTERNAL_REFERENCE, RECORD_TYPE, DESCRIPTION, NET_CREDIT_AMOUNT, NET_DEBIT_AMOUNT, GROSS_AMOUNT,
 * BALANCE_AMOUNT; RECORD_TYPE initial_available_balance / release / total / available_balance.
 * Fonte: mercadopago.com.ar/developers/en/docs/reports/released-money/report-fields. Separador e
 * ponto decimal: suposição (o campo é Numeric(17,2)).
 */
export const MERCADO_PAGO_LIBERACIONES: Amostra = {
  nome: "Mercado Pago AR (liberaciones CSV)",
  fonte: "mercadopago.com.ar/developers (report-fields)",
  tipo: "extrato",
  csv: true,
  texto: [
    "DATE,SOURCE_ID,EXTERNAL_REFERENCE,RECORD_TYPE,DESCRIPTION,NET_CREDIT_AMOUNT,NET_DEBIT_AMOUNT,GROSS_AMOUNT,BALANCE_AMOUNT",
    "2026-10-01T00:00:00.000-03:00,,,initial_available_balance,,,,,1000.00",
    "2026-10-02T10:12:00.000-03:00,1111111111,,release,payment,15000.00,0.00,15600.00,16000.00",
    "2026-10-02T10:12:00.000-03:00,1111111111,,release,tax_credit_debit,0.00,90.00,90.00,15910.00",
    "2026-10-05T09:00:00.000-03:00,2222222222,,release,payout,0.00,10000.00,10000.00,5910.00",
    "2026-10-31T23:59:59.000-03:00,,,total,,15000.00,10090.00,,",
    "2026-10-31T23:59:59.000-03:00,,,available_balance,,,,,5910.00",
  ].join("\n"),
  esperado: [
    ["2026-10-02", 15000, "Cobro"],
    ["2026-10-02", -90, "25413"],
    ["2026-10-05", -10000, "Retiro"],
  ],
};

export const AMOSTRAS_DA_ARGENTINA: Amostra[] = [
  VISA_PRISMA, CABAL, VISA_BBVA, AMEX, NARANJA_X, MASTER_SANTANDER, CAJA_DE_AHORRO, CSV_MOVIMIENTOS, MERCADO_PAGO_LIBERACIONES,
];
