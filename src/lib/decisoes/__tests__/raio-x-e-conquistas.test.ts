import { describe, expect, it } from "vitest";
import { acharRecorrentes, economiaAnual, valorFuturo, type RaioXLancamento } from "../raio-x";
import { somarConquistas } from "../conquistas";

const mes = (month: number, description: string, amount: number, parentCategory: string | null = "LAZER"): RaioXLancamento => ({ description, amount, year: 2026, month, parentCategory });

describe("acharRecorrentes", () => {
  it("acha assinatura que aparece em 3 meses e ignora o que apareceu só 2 vezes", () => {
    const itens = acharRecorrentes([
      mes(6, "NETFLIX.COM", 59.9),
      mes(7, "NETFLIX.COM", 59.9),
      mes(8, "NETFLIX.COM", 59.9),
      mes(7, "Show do Coldplay", 400),
      mes(8, "Show do Coldplay", 400),
    ]);
    expect(itens.map((i) => i.nome)).toEqual(["NETFLIX.COM"]);
    expect(itens[0].tipo).toBe("assinatura");
    expect(itens[0].anual).toBeCloseTo(718.8, 2);
  });

  it("hábito com várias compras no mês vira 'hábito', com a média mensal", () => {
    const cafe = [6, 7, 8].flatMap((m) => Array.from({ length: 10 }, () => mes(m, "Padaria Pão Quente", 12, "ALIMENTACAO")));
    const [item] = acharRecorrentes(cafe);
    expect(item.tipo).toBe("habito");
    expect(item.mensal).toBeCloseTo(120, 5);
  });

  it("deixa de fora moradia, saúde, educação e impostos, e gasto grande demais", () => {
    const itens = acharRecorrentes([
      ...[6, 7, 8].map((m) => mes(m, "Aluguel apartamento", 3000, "MORADIA")),
      ...[6, 7, 8].map((m) => mes(m, "Plano de saúde", 600, "SAUDE")),
      ...[6, 7, 8].map((m) => mes(m, "Loja cara", 2000, "OUTROS")),
    ]);
    expect(itens).toEqual([]);
  });

  it("não junta descrições genéricas de banco como se fossem o mesmo gasto", () => {
    const itens = acharRecorrentes([6, 7, 8].flatMap((m) => [mes(m, "PIX ENVIADO", 150), mes(m, "TRANSFERENCIA ENVIADA", 90)]));
    expect(itens).toEqual([]);
  });

  it("economia: cancelar tira tudo, metade tira metade, manter não tira nada", () => {
    expect(economiaAnual({ anual: 1200 }, "raiox_cancelar")).toBe(1200);
    expect(economiaAnual({ anual: 1200 }, "raiox_metade")).toBe(600);
    expect(economiaAnual({ anual: 1200 }, "raiox_manter")).toBe(0);
    expect(valorFuturo(100, 12, 0)).toBe(1200);
  });
});

describe("somarConquistas", () => {
  it("soma só o que a pessoa decidiu e ignora avisos de erro e compras ainda pendentes", () => {
    const d = (tipo: string, valor: number | null, dia: number) => ({ tipo, valor, createdAt: new Date(2026, 8, dia) });
    const c = somarConquistas([
      d("compra_desisti", 6000, 10),
      d("compra_comprei", 300, 11),
      d("compra_amanha", 900, 12),
      d("raiox_cancelar", 718.8, 5),
      d("raiox_metade", 720, 6),
      d("ritual", null, 7),
      d("fechamento", null, 2),
      d("resposta_errada", null, 3),
    ]);
    expect(c.desistidas).toBe(6000);
    expect(c.raioxAnual).toBeCloseTo(1438.8, 5);
    expect(c.rituais).toBe(1);
    expect(c.fechamentos).toBe(1);
    expect(c.decisoes).toBe(6);
    expect(c.desde?.getDate()).toBe(2);
  });
});

describe("acharRecorrentes: casos que o teste achou", () => {
  it("parcela de compra não é assinatura", () => {
    const itens = acharRecorrentes([mes(6, "LOJA RENNER 03/10", 89.9), mes(7, "LOJA RENNER 04/10", 89.9), mes(8, "LOJA RENNER 05/10", 89.9)]);
    expect(itens).toEqual([]);
  });

  it("descrições genéricas de banco não viram gasto", () => {
    const desc = ["DÉBITO AUTOMÁTICO", "ENVIO PIX", "PIX QR CODE", "JUROS ROTATIVO", "ENCARGOS", "Pagamento efetuado"];
    expect(acharRecorrentes([6, 7, 8].flatMap((m) => desc.map((d) => mes(m, d, 50))))).toEqual([]);
  });

  it("a mesma assinatura com código diferente todo mês é achada; iFood vira um hábito só", () => {
    const spotify = acharRecorrentes([mes(6, "SPOTIFY P1234ABCD", 21.9), mes(7, "SPOTIFY P9876WXYZ", 21.9), mes(8, "SPOTIFY P5555QQQQ", 21.9)]);
    expect(spotify.map((i) => i.chave)).toEqual(["spotify"]);
    const ifood = acharRecorrentes([6, 7, 8].flatMap((m) => [mes(m, "IFOOD *RESTAURANTE X", 45), mes(m, "IFD*BURGER KING", 45), mes(m, "IFOOD PIZZARIA Y", 45), mes(m, "IFD*SUSHI Z", 45)]));
    expect(ifood).toHaveLength(1);
    expect(ifood[0].tipo).toBe("habito");
    expect(ifood[0].mensal).toBe(180);
  });

  it("a média é pelos meses que a pessoa tem no app, não só pelos meses em que o gasto apareceu", () => {
    const itens = acharRecorrentes([
      ...[4, 5, 6, 7, 8].map((m) => mes(m, "Mercado Bom Preço", 300, "ALIMENTACAO")),
      mes(4, "Posto Ipiranga", 200, "TRANSPORTE"),
      mes(6, "Posto Ipiranga", 200, "TRANSPORTE"),
      mes(8, "Posto Ipiranga", 200, "TRANSPORTE"),
    ]);
    expect(itens.find((i) => i.chave.startsWith("posto"))?.anual).toBeCloseTo(1440, 5);
  });

  it("assinatura exige valor estável; cobrança dobrada num mês continua assinatura", () => {
    const posto = acharRecorrentes([mes(6, "Posto Shell", 180), mes(7, "Posto Shell", 250), mes(8, "Posto Shell", 120)]);
    expect(posto[0].tipo).toBe("habito");
    const dobrada = acharRecorrentes([mes(6, "NETFLIX.COM", 59.9), mes(7, "NETFLIX.COM", 59.9), mes(7, "NETFLIX.COM", 59.9), mes(8, "NETFLIX.COM", 59.9)]);
    expect(dobrada[0].tipo).toBe("assinatura");
  });
});

describe("acharRecorrentes: segunda rodada, formatos reais de extrato", () => {
  const tres = (desc: (m: number) => string[], valor: number, cat: string | null = "LAZER") => [6, 7, 8].flatMap((m) => desc(m).map((d) => mes(m, d, valor, cat)));

  it("corridas da 99 aparecem", () => {
    const itens = acharRecorrentes(tres(() => ["99* 99POP", "99APP *99APP", "99 TECNOLOGIA LTDA", "99* 99POP"], 20, "TRANSPORTE"));
    expect(itens.map((i) => i.chave)).toEqual(["99 app"]);
  });

  it("data no meio da descrição não é parcela", () => {
    const itens = acharRecorrentes(tres((m) => [`PADARIA DOCE PAO 02/0${m}`, `PADARIA DOCE PAO 05/0${m}`], 15, "ALIMENTACAO"));
    expect(itens).toHaveLength(1);
  });

  it("RSHOP com postos diferentes não vira um gasto só; débito e cartão do mesmo lugar se juntam", () => {
    const postos = acharRecorrentes([mes(6, "RSHOP-POSTO SHELL-10/06", 200), mes(7, "RSHOP-POSTO IPIRANGA-12/07", 200), mes(8, "RSHOP-POSTO PETROBRAS-15/08", 200)]);
    expect(postos).toEqual([]);
    const padaria = acharRecorrentes([mes(6, "Compra no débito - PADARIA PAO DOURADO", 30), mes(7, "COMPRA CARTAO DEB MC PADARIA PAO DOURADO", 30), mes(8, "PADARIA PAO DOURADO", 30)]);
    expect(padaria).toHaveLength(1);
  });

  it("assinatura vale o preço dela, e a que parou não aparece", () => {
    const base5 = [4, 5].map((m) => mes(m, "Mercado X", 100, "ALIMENTACAO"));
    const ativa = acharRecorrentes([...base5, ...[6, 7, 8].map((m) => mes(m, "NETFLIX.COM", 59.9))]);
    expect(ativa.find((i) => i.chave === "netflix")?.anual).toBeCloseTo(718.8, 5);
    const parou = acharRecorrentes([...[6, 7, 8].map((m) => mes(m, "Mercado X", 100, "ALIMENTACAO")), ...[4, 5, 6].map((m) => mes(m, "NETFLIX.COM", 59.9))]);
    expect(parou.find((i) => i.chave === "netflix")).toBeUndefined();
  });

  it("boleto de bancos diferentes, Pix pra pessoa e encargos não viram gasto", () => {
    expect(acharRecorrentes(tres(() => ["INT PAG TIT BANCO 237", "INT PAG TIT BANCO 341"], 80))).toEqual([]);
    expect(acharRecorrentes(tres(() => ["Transferência enviada pelo Pix - MARIA SOUZA - •••.123.456-•• - NU PAGAMENTOS"], 300))).toEqual([]);
    expect(acharRecorrentes(tres(() => ["MULTA POR ATRASO", "IOF DIARIO ROTATIVO", "JUROS REMUNERATORIOS ROTATIVO"], 20))).toEqual([]);
  });

  it("academia entra mesmo classificada em Saúde; parcela 'PARC03/10' não", () => {
    expect(acharRecorrentes(tres(() => ["SMARTFIT MENSALIDADE"], 119.9, "SAUDE")).map((i) => i.tipo)).toEqual(["assinatura"]);
    expect(acharRecorrentes([6, 7, 8].map((m, i) => mes(m, `MAGAZINE LUIZA PARC0${i + 3}/10`, 150)))).toEqual([]);
  });

  it("compra grande da mesma marca não derruba a assinatura; reajuste continua assinatura", () => {
    const apple = acharRecorrentes([...[4, 5, 6, 7, 8].map((m) => mes(m, "APPLE.COM/BILL", 4.9)), mes(7, "APPLE.COM/BR", 7999)]);
    expect(apple.find((i) => i.chave === "apple")?.tipo).toBe("assinatura");
    const netflix = acharRecorrentes([5, 6, 7, 8].map((m) => mes(m, "NETFLIX.COM", m < 7 ? 39.9 : 55.9)));
    expect(netflix[0].tipo).toBe("assinatura");
  });

  it("assinaturas vêm antes dos hábitos grandes na lista", () => {
    const habitos = ["ATACADAO", "ASSAI", "PAO DE ACUCAR", "CARREFOUR", "DIA SUPERMERCADO", "OXXO", "HORTIFRUTI", "SACOLAO", "EMPORIO", "FEIRA LIVRE"];
    const itens = acharRecorrentes([...tres(() => [...habitos, ...habitos], 150, "ALIMENTACAO"), ...tres(() => ["SPOTIFY"], 21.9)]);
    expect(itens[0].chave).toBe("spotify");
  });
});

describe("acharRecorrentes: dinheiro indo pra ela mesma e categoria personalizada", () => {
  it("aplicação, caixinha e pagamento de fatura não viram gasto", () => {
    const d = ["Aplicação RDB", "Pix enviado - Nu Caixinha", "Pagamento de fatura", "APLICACAO CDB DI"];
    expect(acharRecorrentes([6, 7, 8].flatMap((m) => d.map((x) => mes(m, x, 500, "OUTROS"))))).toEqual([]);
  });
  it("escola em categoria personalizada não é sugerida pra cancelar", () => {
    expect(acharRecorrentes([6, 7, 8].map((m) => mes(m, "Escola Pequeno Principe", 750, null)))).toEqual([]);
  });
});
