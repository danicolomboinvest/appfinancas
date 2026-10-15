import { describe, expect, it } from "vitest";
import { faturasDoCartao, totalDaFatura, type LancamentoDoCartao } from "../faturas-do-cartao";
import { finalDoCartao, nomeDoCartao, slugDoBancoLido } from "@/lib/cartao/bancos";

const cartao = { id: "c1", banco: "nubank", apelido: null, diaFechamento: 15, diaVencimento: 22 };
let n = 0;
const l = (entryDate: string | null, amount: number, year = Number(entryDate?.slice(0, 4) ?? 2026), month = Number(entryDate?.slice(5, 7) ?? 11)): LancamentoDoCartao => ({
  id: `l${n++}`, year, month, entryDate, amount, description: "Compra",
});
const hoje = { ano: 2026, mes: 10, dia: 15 };

describe("faturas do cartão: o total é a soma dos lançamentos ligados", () => {
  const lancamentos = [
    l("2026-10-14", 100), // véspera do fechamento: fatura de outubro
    l("2026-10-15", 89.9), // no fechamento: novembro
    l("2026-10-20", 10.1), // novembro
    l("2026-11-15", 50), // fechamento de novembro: dezembro
    l("2026-10-16", -20), // estorno: desconta de novembro
    l(null, 30, 2026, 11), // fatura importada sem dia, no mês do vencimento: novembro
  ];

  it("aberta, próxima e a fechada a pagar", () => {
    const f = faturasDoCartao(cartao, lancamentos, hoje)!;
    expect(f.aberta.chave).toBe("2026-11");
    expect(f.aberta.total).toBe(110);
    expect(f.aberta.lancamentos.map((x) => x.amount).reduce((a, b) => a + b, 0)).toBeCloseTo(f.aberta.total, 2);
    expect(f.proxima.chave).toBe("2026-12");
    expect(f.proxima.total).toBe(50);
    expect(f.fechada?.chave).toBe("2026-10");
    expect(f.fechada?.total).toBe(100);
    expect(f.melhorDia).toBe(15);
  });

  it("o total de uma fatura pela chave bate com o da tela", () => {
    expect(totalDaFatura(cartao, lancamentos, "2026-11")).toBe(faturasDoCartao(cartao, lancamentos, hoje)!.aberta.total);
  });

  it("a fatura fechada some depois que vence", () => {
    expect(faturasDoCartao(cartao, lancamentos, { ano: 2026, mes: 10, dia: 23 })!.fechada).toBeNull();
  });

  it("cartão sem os dias não tem faturas", () => {
    expect(faturasDoCartao({ ...cartao, diaFechamento: null }, lancamentos, hoje)).toBeNull();
  });
});

describe("bancos do cartão", () => {
  it("reconhece o banco que a importação leu", () => {
    expect(slugDoBancoLido("Nubank")).toBe("nubank");
    expect(slugDoBancoLido("Itaú")).toBe("itau");
    expect(slugDoBancoLido("C6 Bank")).toBe("c6bank");
    expect(slugDoBancoLido("BTG Pactual")).toBe("btgpactual");
    expect(slugDoBancoLido("Inter")).toBe("inter");
    expect(slugDoBancoLido("Sicredi")).toBeNull();
    expect(slugDoBancoLido(null)).toBeNull();
  });

  it("o nome: o apelido dela ou o do banco", () => {
    expect(nomeDoCartao({ banco: "itau", apelido: null })).toBe("Itaú");
    expect(nomeDoCartao({ banco: "itau", apelido: "Personnalité" })).toBe("Personnalité");
    expect(nomeDoCartao({ banco: "outro", apelido: null })).toBe("Cartão");
  });

  it("os 4 últimos dígitos impressos na fatura", () => {
    expect(finalDoCartao("Cartão Visa Final 4821\nCompras...")).toBe("4821");
    expect(finalDoCartao("Fatura Cartão de Crédito;Final Cartão;1234\n;1234\n;9999")).toBe("1234");
    expect(finalDoCartao("5502 **** **** 7781 Titular")).toBe("7781");
    expect(finalDoCartao("Total R$ 1.234,56")).toBeNull();
  });
});
