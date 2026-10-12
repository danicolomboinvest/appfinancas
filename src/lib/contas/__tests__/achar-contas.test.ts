import { describe, expect, it } from "vitest";
import type { LancamentoParaCacar } from "@/lib/dinheiro-perdido/detectar";
import { acharContas, diaDoVencimento, jaCadastrada, mesmaCobranca, proximoVencimento } from "../achar-contas";

let seq = 0;
function l(descricao: string, valor: number, data: string, extra: Partial<LancamentoParaCacar> = {}): LancamentoParaCacar {
  seq += 1;
  return { id: `l${seq}`, descricao, valor, data, ano: Number(data.slice(0, 4)), mes: Number(data.slice(5, 7)), tipo: "EXPENSE", categoria: null, subcategoria: null, lote: "lote1", ...extra };
}
/** A mesma cobrança de maio a setembro de 2026 (ou quantos valores vierem), no dia dado. */
function todoMes(descricao: string, valores: number[], dia: number | number[] = 10, extra: Partial<LancamentoParaCacar> = {}) {
  return valores.map((v, i) => {
    const d = Array.isArray(dia) ? dia[i] : dia;
    return l(descricao, v, `2026-${String(5 + i).padStart(2, "0")}-${String(d).padStart(2, "0")}`, extra);
  });
}
const nomes = (r: ReturnType<typeof acharContas>) => r.map((c) => c.nome);

describe("acha as contas no histórico", () => {
  it("Vivo todo dia 10 vira a conta Vivo, dia 10, com o valor de sempre", () => {
    const r = acharContas(todoMes("VIVO SP 1234", [89.99, 89.99, 89.99, 89.99]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nome: "Vivo", tipo: "telefone", valor: 89.99, aproximado: false, dia: 10, chave: "m:vivo" });
  });

  it("conta clara aparece com 2 meses; boleto de prestador precisa de 3", () => {
    expect(nomes(acharContas(todoMes("SABESP", [80, 92])))).toEqual(["Sabesp"]);
    expect(acharContas(todoMes("Pagamento de boleto efetuado - CONTABILIDADE ALFA", [300, 300]))).toHaveLength(0);
    expect(acharContas(todoMes("Pagamento de boleto efetuado - CONTABILIDADE ALFA", [300, 300, 300]))).toHaveLength(1);
  });

  it("luz variando entra com a média dos últimos 3 meses, aproximada", () => {
    const r = acharContas(todoMes("ENEL DISTRIBUICAO SAO PAULO", [120, 180, 150, 210], [8, 9, 8, 8]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nome: "Enel", tipo: "luz", aproximado: true, dia: 8 });
    expect(r[0].valor).toBe(180);
  });

  it("parcela (1/3) não vira conta", () => {
    const r = acharContas([l("Colegio Novo (1/3)", 500, "2026-07-10"), l("Colegio Novo (2/3)", 500, "2026-08-10"), l("Colegio Novo (3/3)", 500, "2026-09-10")]);
    expect(r).toHaveLength(0);
  });

  it("Netflix não vira conta: é assinatura, mora em Assinaturas", () => {
    expect(acharContas(todoMes("NETFLIX.COM", [55.9, 55.9, 55.9, 55.9]))).toHaveLength(0);
  });

  it("Pix para pessoa não vira conta", () => {
    expect(acharContas(todoMes("Pix enviado - Maria Souza - •••.123.456-••", [400, 400, 400, 400]))).toHaveLength(0);
  });

  it("Pix para pessoa marcado como aluguel vira a conta Aluguel", () => {
    const r = acharContas(todoMes("Pix enviado - Joao Lima - •••.123.456-••", [2500, 2500, 2500], 5, { categoria: "MORADIA", subcategoria: "Aluguel" }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nome: "Aluguel", tipo: "aluguel", valor: 2500, dia: 5, categoria: "MORADIA" });
  });

  it("mercado, iFood e fatura do cartão não viram conta", () => {
    const r = acharContas([
      ...todoMes("SUPERMERCADO DIA A DIA", [300, 300, 300, 300], 3, { categoria: "ALIMENTACAO" }),
      ...todoMes("IFOOD *RESTAURANTE", [50, 50, 50, 50]),
      ...todoMes("Pagamento de fatura", [2000, 2000, 2000, 2000]),
      ...todoMes("Aplicacao CDB", [500, 500, 500, 500]),
    ]);
    expect(r).toHaveLength(0);
  });

  it("parou de cobrar há meses: não é mais conta", () => {
    const r = acharContas([...todoMes("CLARO MOVEL", [70, 70, 70]), l("Padaria", 10, "2026-10-02"), l("Padaria", 10, "2026-11-02")]);
    expect(r).toHaveLength(0);
  });

  it("valor que pula para todo lado num boleto de prestador não é conta", () => {
    expect(acharContas(todoMes("Pagamento de boleto - LOJA XPTO", [100, 400, 50, 260]))).toHaveLength(0);
  });

  it("plano de saúde com reajuste: o valor novo, exato", () => {
    const r = acharContas(todoMes("UNIMED BH", [600, 600, 690, 690]));
    expect(r[0]).toMatchObject({ nome: "Unimed", tipo: "saude", valor: 690, aproximado: false });
  });
});

describe("dia do vencimento", () => {
  it("o dia mais frequente", () => expect(diaDoVencimento([10, 10, 8, 10])).toBe(10));
  it("espalhado pelo fim de semana: o mais cedo", () => expect(diaDoVencimento([10, 12, 11])).toBe(10));
  it("empate: o mais cedo", () => expect(diaDoVencimento([15, 5, 15, 5])).toBe(5));
});

describe("não duplica", () => {
  const vivo = { chave: "m:vivo", nome: "Vivo", tipo: "telefone" as const, valor: 89.99 };
  it("a Vivo que ela cadastrou", () => expect(jaCadastrada(vivo, [{ nome: "vivo", valor: 90 }])).toBe(true));
  it("o Celular de valor parecido", () => expect(jaCadastrada(vivo, [{ nome: "Celular", valor: 95 }])).toBe(true));
  it("a Luz cadastrada casa com a Enel", () => expect(jaCadastrada({ chave: "m:enel", nome: "Enel", tipo: "luz", valor: 180 }, [{ nome: "Conta de luz", valor: null }])).toBe(true));
  it("o comerciante pelo nome", () => expect(jaCadastrada({ chave: "contabilidade alfa", nome: "Contabilidade Alfa", tipo: "contabilidade", valor: 300 }, [{ nome: "Contabilidade Alfa", valor: 280 }])).toBe(true));
  it("a achada antes, pela chave", () => expect(jaCadastrada(vivo, [{ nome: "Meu chip", valor: 10, chaveDoHistorico: "m:vivo" }])).toBe(true));
  it("conta de outro tipo não segura", () => expect(jaCadastrada(vivo, [{ nome: "Aluguel", valor: 2000 }])).toBe(false));
  it("a assinatura Smart Fit some quando virou conta", () => expect(mesmaCobranca("Smart Fit", [{ nome: "Smart Fit", valor: 119.9, chaveDoHistorico: "m:smartfit" }])).toBe(true));
});

describe("próximo vencimento", () => {
  const hoje = new Date(Date.UTC(2026, 9, 12));
  it("ainda não chegou e não saiu: este mês", () => expect(proximoVencimento(20, hoje, ["2026-09"]).toISOString().slice(0, 10)).toBe("2026-10-20"));
  it("já saiu neste mês: o mês que vem", () => expect(proximoVencimento(20, hoje, ["2026-10"]).toISOString().slice(0, 10)).toBe("2026-11-20"));
  it("o dia já passou: o mês que vem", () => expect(proximoVencimento(10, hoje, ["2026-09"]).toISOString().slice(0, 10)).toBe("2026-11-10"));
  it("dia 31 em novembro vira 30", () => expect(proximoVencimento(31, hoje, ["2026-10"]).toISOString().slice(0, 10)).toBe("2026-11-30"));
});
