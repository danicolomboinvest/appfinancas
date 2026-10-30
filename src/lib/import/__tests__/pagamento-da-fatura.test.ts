import { describe, expect, it } from "vitest";
import { faturaQuePaga, faturasNoApp, pagamentoDoCartao, pagamentoTemFatura, pagamentosDaFatura, valorBate, type LinhaDeFatura } from "../pagamento-da-fatura";

/** Compra de fatura importada pela data da compra (modelo novo), sem cartão cadastrado. */
const compra = (loteId: string, entryDate: string, valor: number, descricao = "MERCADO"): LinhaDeFatura => ({
  loteId,
  year: Number(entryDate.slice(0, 4)),
  month: Number(entryDate.slice(5, 7)),
  entryDate,
  valor,
  descricao,
});
/** Fatura no modelo antigo: tudo no mês escolhido, sem dia. */
const antiga = (loteId: string, year: number, month: number, valor: number, descricao = "MERCADO"): LinhaDeFatura => ({ loteId, year, month, entryDate: null, valor, descricao });
/** Compra ligada a um cartão cadastrado (fecha dia 5, vence dia 12). */
const noCartao = (entryDate: string, valor: number, descricao = "MERCADO", cartaoId = "nubank"): LinhaDeFatura => ({
  ...compra(null as unknown as string, entryDate, valor, descricao),
  loteId: null,
  cartaoId,
  cartao: { diaFechamento: 5, diaVencimento: 12 },
});

/** A fatura de OUTUBRO (compras de 26/08 a 25/09), R$ 2.800 ao todo. */
const faturaOutubro = [compra("out", "2026-08-26", 1500), compra("out", "2026-09-10", 800), compra("out", "2026-09-25", 500)];

describe("o pagamento só sai quando a fatura dele está no app, pela data E pelo valor", () => {
  it("o cenário errado de antes: fatura de outubro no app, o Pix de 08/09 paga a de SETEMBRO (não importada) e fica como gasto", () => {
    const faturas = faturasNoApp(faturaOutubro);
    expect(faturas).toHaveLength(1);
    expect(faturas[0]).toMatchObject({ total: 2800, pagavelDe: "2026-09-25", pagavelAte: "2026-10-20" });
    // Setembro: compras do fim de agosto estão na fatura de outubro, mas o pagamento não é dela.
    expect(pagamentoTemFatura({ data: "2026-09-08", valor: 1900 }, faturas)).toBe(false);
    expect(pagamentoTemFatura({ data: "2026-09-08", valor: 2800 }, faturas)).toBe(false); // nem com o mesmo valor: antes do fechamento
    expect(pagamentosDaFatura([{ id: "set", data: "2026-09-08", valor: 1900 }], faturas).size).toBe(0);
    expect(pagamentoDoCartao({ data: "2026-09-08", valor: 1900 }, faturas)).toMatchObject({ subcategory: "Cartão de crédito" });
  });

  it("o pagamento certo: em outubro, com o valor da fatura, fica de fora (ou sai, se a fatura chegou depois)", () => {
    const faturas = faturasNoApp(faturaOutubro);
    expect(pagamentoTemFatura({ data: "2026-10-08", valor: 2800 }, faturas)).toBe(true);
    expect(pagamentoDoCartao({ data: "2026-10-08", valor: 2800 }, faturas)).toMatchObject({ ignorar: true, nota: expect.stringMatching(/só mudou de conta/) });
    expect([...pagamentosDaFatura([{ id: "out", data: "2026-10-08", valor: 2800 }], faturas)]).toEqual(["out"]);
    // Atraso de alguns dias ainda é esta fatura; um mês depois, não.
    expect(pagamentoTemFatura({ data: "2026-10-20", valor: 2800 }, faturas)).toBe(true);
    expect(pagamentoTemFatura({ data: "2026-11-05", valor: 2800 }, faturas)).toBe(false);
  });

  it("pagamento mínimo ou parcial NÃO bate: continua gasto e nada é apagado", () => {
    const faturas = faturasNoApp(faturaOutubro);
    expect(pagamentoTemFatura({ data: "2026-10-08", valor: 420 }, faturas)).toBe(false); // mínimo (15%)
    expect(pagamentoTemFatura({ data: "2026-10-08", valor: 1400 }, faturas)).toBe(false); // metade
    expect(pagamentoTemFatura({ data: "2026-10-08", valor: 3200 }, faturas)).toBe(false); // outro cartão, mais caro
    const doisPix = [
      { id: "pix1", data: "2026-10-08", valor: 1400 },
      { id: "pix2", data: "2026-10-09", valor: 1400 },
    ];
    expect(pagamentosDaFatura(doisPix, faturas).size).toBe(0);
  });

  it("a tolerância do valor: até 1% do total, no máximo R$ 10, no mínimo 5 centavos", () => {
    expect(valorBate(2800, 2800)).toBe(true);
    expect(valorBate(2800.01, 2800)).toBe(true);
    expect(valorBate(2790, 2800)).toBe(true); // 10 de 28 possíveis, cabe no teto de R$ 10
    expect(valorBate(2785, 2800)).toBe(false); // 15 passa do teto de R$ 10
    expect(valorBate(50.04, 50)).toBe(true); // 1% de 50 é 0,50
    expect(valorBate(50.6, 50)).toBe(false);
    expect(valorBate(0, 2800)).toBe(false);
    expect(valorBate(2800, 0)).toBe(false);
  });

  it("fatura só de parcelas cobre o pagamento (antes nunca cobria)", () => {
    const faturas = faturasNoApp([compra("out", "2026-09-10", 300, "SOFA PARC 02/10"), compra("out", "2026-09-20", 150, "TV 05/12")]);
    expect(faturas[0]).toMatchObject({ total: 450 });
    expect(pagamentoTemFatura({ data: "2026-10-05", valor: 450 }, faturas)).toBe(true);
  });

  it("a parcela que a fatura projetou para os meses seguintes não entra no total dela", () => {
    const linhas = [
      ...faturaOutubro,
      compra("out", "2026-09-05", 200, "LOJA PARC 01/03"),
      // Projeções da 2/3 e da 3/3, no mesmo lote, nos meses seguintes.
      compra("out", "2026-10-05", 200, "LOJA PARC 02/03"),
      compra("out", "2026-11-05", 200, "LOJA PARC 03/03"),
    ];
    const [f] = faturasNoApp(linhas);
    expect(f.total).toBe(3000);
    expect(f.linhas).toBe(4);
    expect(pagamentoTemFatura({ data: "2026-10-08", valor: 3000 }, faturasNoApp(linhas))).toBe(true);
  });

  it("estorno (valor negativo) desconta do total da fatura", () => {
    const faturas = faturasNoApp([...faturaOutubro, compra("out", "2026-09-12", -100, "ESTORNO LOJA")]);
    expect(faturas[0].total).toBe(2700);
    expect(pagamentoTemFatura({ data: "2026-10-08", valor: 2700 }, faturas)).toBe(true);
    expect(pagamentoTemFatura({ data: "2026-10-08", valor: 2800 }, faturas)).toBe(false);
  });
});

describe("fatura fechada pelo cartão cadastrado (compra à mão ou importada ligada ao cartão)", () => {
  // Fecha dia 5, vence dia 12: compras de 05/08 a 04/09 são a fatura de setembro (vence 12/09).
  const setembro = [noCartao("2026-08-10", 1000), noCartao("2026-08-28", 500), noCartao("2026-09-04", 250)];
  const outubro = [noCartao("2026-09-05", 2000), noCartao("2026-09-20", 100)];

  it("cada compra entra na fatura que a regra do cartão diz, com a janela do fechamento ao vencimento + 10 dias", () => {
    const faturas = faturasNoApp([...setembro, ...outubro]);
    expect(faturas.map((f) => [f.chave, f.total, f.pagavelDe, f.pagavelAte])).toEqual([
      ["cartao:nubank:2026-09", 1750, "2026-09-05", "2026-09-22"],
      ["cartao:nubank:2026-10", 2100, "2026-10-05", "2026-10-22"],
    ]);
  });

  it("o pagamento de setembro casa com setembro; o de outubro com outubro; o antecipado ou atrasado demais, com nenhuma", () => {
    const faturas = faturasNoApp([...setembro, ...outubro]);
    expect(faturaQuePaga({ data: "2026-09-12", valor: 1750 }, faturas)?.chave).toBe("cartao:nubank:2026-09");
    expect(faturaQuePaga({ data: "2026-10-12", valor: 2100 }, faturas)?.chave).toBe("cartao:nubank:2026-10");
    expect(faturaQuePaga({ data: "2026-09-04", valor: 1750 }, faturas)).toBeNull();
    expect(faturaQuePaga({ data: "2026-09-30", valor: 1750 }, faturas)).toBeNull();
    expect(faturaQuePaga({ data: "2026-09-12", valor: 2100 }, faturas)).toBeNull(); // valor de outubro em setembro
  });

  it("dois cartões, as duas faturas no app: cada pagamento sai com a sua; o terceiro cartão, sem fatura, fica", () => {
    const itau = [noCartao("2026-08-20", 700, "LOJA C", "itau")];
    const faturas = faturasNoApp([...setembro, ...itau]);
    const pagamentos = [
      { id: "nubank", data: "2026-09-12", valor: 1750 },
      { id: "itau", data: "2026-09-10", valor: 700 },
      { id: "c6", data: "2026-09-11", valor: 3200 },
    ];
    expect([...pagamentosDaFatura(pagamentos, faturas)].sort()).toEqual(["itau", "nubank"]);
  });

  it("uma fatura leva no máximo um pagamento (o Pix repetido continua gasto para ela decidir)", () => {
    const faturas = faturasNoApp(setembro);
    const pagamentos = [
      { id: "a", data: "2026-09-12", valor: 1750 },
      { id: "b", data: "2026-09-13", valor: 1750 },
    ];
    expect(pagamentosDaFatura(pagamentos, faturas).size).toBe(1);
  });
});

describe("fatura no modelo antigo (tudo num mês, sem dia)", () => {
  it("o pagamento do mês, do seguinte ou do fim do anterior sai, se o valor bate", () => {
    const faturas = faturasNoApp([antiga("L1", 2026, 9, 1800, "LOJA A"), antiga("L1", 2026, 9, 200, "LOJA B")]);
    expect(faturas[0]).toMatchObject({ total: 2000, pagavelDe: "2026-08-20", pagavelAte: "2026-10-31" });
    expect(pagamentoTemFatura({ data: "2026-09-12", valor: 2000 }, faturas)).toBe(true);
    expect(pagamentoTemFatura({ data: "2026-10-02", valor: 2000 }, faturas)).toBe(true); // "a fatura de setembro é de agosto" ao contrário
    expect(pagamentoTemFatura({ data: "2026-08-29", valor: 2000 }, faturas)).toBe(true); // vence 02/09, pagou antes
    expect(pagamentoTemFatura({ data: "2026-08-10", valor: 2000 }, faturas)).toBe(false);
    expect(pagamentoTemFatura({ data: "2026-09-12", valor: 1200 }, faturas)).toBe(false);
  });

  it("a parcela projetada pela fatura antiga cai nos meses seguintes e não entra no total", () => {
    const faturas = faturasNoApp([antiga("L1", 2026, 9, 1000), antiga("L1", 2026, 9, 100, "SOFA PARC 01/03"), antiga("L1", 2026, 10, 100, "SOFA PARC 02/03"), antiga("L1", 2026, 11, 100, "SOFA PARC 03/03")]);
    expect(faturas).toHaveLength(1);
    expect(faturas[0].total).toBe(1100);
  });

  it("sem fatura nenhuma em volta, o pagamento continua gasto", () => {
    expect(pagamentoTemFatura({ data: "2026-09-12", valor: 1500 }, [])).toBe(false);
    expect(pagamentosDaFatura([{ id: "p", data: "2026-09-12", valor: 1500 }], faturasNoApp([antiga("L1", 2026, 6, 1500)])).size).toBe(0);
  });
});
