import { describe, expect, it } from "vitest";
import { ehDoAno, faltaNoMes, pagaNoMes, pesoPorMes, vencimentosDaJanela, type ContaDaAba } from "../recorrentes";

const hoje = new Date(Date.UTC(2026, 9, 7));
const base = { repete: true, intervalo: null, unidade: null, mesesEscolhidos: [], parcelas: null, pagaEm: null, diaDoMes: null, parcelaAtual: null, aproximado: false };
const conta = (o: Partial<ContaDaAba> & Pick<ContaDaAba, "id" | "nome" | "valor" | "vencimento">): ContaDaAba => ({ ...base, ...o });

// As contas da Ana no protótipo: aluguel e condomínio pagos no dia 1, luz aproximada, internet,
// diarista a cada 2 semanas, IPVA e seguro do ano.
const ana: ContaDaAba[] = [
  conta({ id: "aluguel", nome: "Aluguel", valor: 2016, vencimento: "2026-11-01", pagaEm: "2026-10-01", diaDoMes: 1 }),
  conta({ id: "cond", nome: "Condomínio", valor: 650, vencimento: "2026-11-01", pagaEm: "2026-10-01", diaDoMes: 1 }),
  conta({ id: "luz", nome: "Luz", valor: 130, vencimento: "2026-10-10", aproximado: true }),
  conta({ id: "net", nome: "Internet", valor: 99.9, vencimento: "2026-10-13" }),
  conta({ id: "diarista", nome: "Diarista", valor: 180, vencimento: "2026-10-15", intervalo: 2, unidade: "semanas" }),
  conta({ id: "ipva", nome: "IPVA", valor: 2400, vencimento: "2027-03-10", intervalo: 1, unidade: "anos" }),
  conta({ id: "seguro", nome: "Seguro do carro", valor: 1560, vencimento: "2027-06-10", intervalo: 1, unidade: "anos" }),
];

describe("Recorrentes da Ana", () => {
  it("separa as contas do ano das do dia a dia", () => {
    expect(ana.filter(ehDoAno).map((c) => c.id)).toEqual(["ipva", "seguro"]);
  });

  it("aluguel pago no dia 1 conta como pago; a diarista paga no dia 15 com outra no 29 não", () => {
    expect(pagaNoMes(ana[0], hoje)).toBe(true);
    expect(pagaNoMes(conta({ id: "d", nome: "Diarista", valor: 180, vencimento: "2026-10-29", pagaEm: "2026-10-15", intervalo: 2, unidade: "semanas" }), hoje)).toBe(false);
  });

  it("faltam R$ 409,90 em 3 contas neste mês, com a luz aproximada", () => {
    // Luz 130 + Internet 99,90 + Diarista 180 (a próxima, dia 15).
    expect(faltaNoMes(ana, hoje)).toEqual({ total: 409.9, quantas: 3, aproximado: true });
  });

  it("separar para as contas do ano: R$ 480 + R$ 195 = R$ 675 por mês", () => {
    const p = pesoPorMes(ana, hoje);
    expect(p.contasDoAno).toBe(675);
    // Aluguel, condomínio, luz, internet e a diarista pela média (R$ 390).
    expect(p.contas).toBe(Math.round(2016 + 650 + 130 + 99.9 + 390));
    expect(p.parcelas).toBe(0);
  });

  it("a semana das contas acha a diarista nos dias 15 e 29 e o aluguel em 1º de novembro", () => {
    const v = vencimentosDaJanela(ana, hoje, 30);
    expect(v.filter((x) => x.id === "diarista").map((x) => x.dia)).toEqual(["2026-10-15", "2026-10-29"]);
    expect(v.filter((x) => x.dia === "2026-11-01").map((x) => x.id).sort()).toEqual(["aluguel", "cond"]);
    expect(v.some((x) => x.id === "ipva")).toBe(false);
  });

  it("parcelada pesa a parcela e não aparece depois da última", () => {
    const tv = conta({ id: "tv", nome: "TV", valor: 200, vencimento: "2026-10-20", parcelas: 10, parcelaAtual: 10 });
    expect(pesoPorMes([tv], hoje).parcelas).toBe(200);
    expect(vencimentosDaJanela([tv], hoje, 60).map((x) => x.dia)).toEqual(["2026-10-20"]);
  });
});
