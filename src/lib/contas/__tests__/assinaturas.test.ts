import { describe, expect, it } from "vitest";
import type { LancamentoParaCacar } from "@/lib/dinheiro-perdido/detectar";
import { cacarDinheiroPerdido } from "@/lib/dinheiro-perdido/detectar";
import { contasDoMes, lancamentoDaConta } from "@/lib/decisoes/semana-fixa";
import { chaveDaRecusa, chaveDoComercianteDe, comerciantesParaEscolher, ehDaAssinatura, juntarAssinaturas, vencimentoDaAssinatura } from "../assinaturas";

let seq = 0;
function l(descricao: string, valor: number, data: string, extra: Partial<LancamentoParaCacar> = {}): LancamentoParaCacar {
  seq += 1;
  return { id: `l${seq}`, descricao, valor, data, ano: Number(data.slice(0, 4)), mes: Number(data.slice(5, 7)), tipo: "EXPENSE", categoria: null, subcategoria: null, ...extra };
}

describe("escolher dos meus lançamentos", () => {
  it("um item por comerciante, com o último valor e quantas vezes apareceu; o que se repete vem primeiro", () => {
    const r = comerciantesParaEscolher([
      l("PG *MANYCHAT", 850, "2026-08-28"),
      l("PG *MANYCHAT", 899, "2026-09-28", { categoria: "OUTROS" }),
      l("Padaria Pão Quente", 12, "2026-10-02"),
      l("NETFLIX.COM", 59.9, "2026-09-08"),
      l("NETFLIX.COM", 59.9, "2026-10-08"),
    ]);
    expect(r.map((c) => c.nome)).toEqual(["Netflix", "Manychat", "Padaria Pao Quente"].map((n) => r.find((c) => c.nome.toLowerCase() === n.toLowerCase())?.nome ?? n));
    const many = r.find((c) => c.chave.includes("manychat"))!;
    expect(many).toMatchObject({ ultimoValor: 899, vezes: 2, meses: 2, ultimaData: "2026-09-28", categoria: "OUTROS" });
    expect(r[r.length - 1].vezes).toBe(1);
  });

  it("deixa de fora parcela, Pix para pessoa, aplicação, estorno e o que ela já marcou", () => {
    const r = comerciantesParaEscolher(
      [
        l("LOJA X 03/10", 100, "2026-10-01"),
        l("PIX ENVIADO MARIA ***.123.456-**", 50, "2026-10-01"),
        l("APLICACAO CDB", 500, "2026-10-01"),
        l("Cancelamento Kiwify", 29.9, "2026-10-01", { estorno: true }),
        l("NETFLIX.COM", 59.9, "2026-10-08"),
        l("SPOTIFY", 21.9, "2026-10-08"),
      ],
      new Set(["m:netflix"]),
    );
    expect(r.map((c) => c.chave)).toEqual(["m:spotify"]);
  });
});

describe("a lista de Assinaturas", () => {
  const dela = [{ id: "a1", nome: "Netflix", valor: 59.9, diaDoMes: 8, chaveDoHistorico: "m:netflix", categoria: "LAZER" }];

  it("a dela vence a achada do mesmo comerciante ou nome: não duplica", () => {
    const r = juntarAssinaturas({
      dela,
      achadas: [
        { chave: "rx:netflix com", nome: "Netflix", mensal: 55.9 },
        { chave: "dp:assinatura:m:netflix", nome: "NETFLIX", mensal: 55.9, comerciante: "m:netflix" },
        { chave: "rx:spotify", nome: "Spotify", mensal: 21.9 },
      ],
      contas: [],
      recusas: new Set(),
      lancamentosDoMes: [],
    });
    expect(r.map((a) => `${a.origem}:${a.nome}:${a.mensal}`)).toEqual(["sua:Netflix:59.9", "extrato:Spotify:21.9"]);
  });

  it("'Não é assinatura' esconde a achada para sempre", () => {
    const r = juntarAssinaturas({ dela: [], achadas: [{ chave: "rx:x", nome: "Spotify", mensal: 21.9 }], contas: [], recusas: new Set([chaveDaRecusa("SPOTIFY")]), lancamentosDoMes: [] });
    expect(r).toEqual([]);
  });

  it("a achada que já é conta (a academia em Contas) não aparece de novo", () => {
    const r = juntarAssinaturas({ dela: [], achadas: [{ chave: "rx:smart", nome: "Smart Fit", mensal: 119.9 }], contas: [{ nome: "Smart Fit", valor: 119.9, chaveDoHistorico: "m:smartfit" }], recusas: new Set(), lancamentosDoMes: [] });
    expect(r).toEqual([]);
  });

  it("pago este mês: o comerciante aprendido reconhece a cobrança mesmo com outro texto", () => {
    const many = { id: "a2", nome: "Meu ManyChat", valor: 899, diaDoMes: 28, chaveDoHistorico: chaveDoComercianteDe("PG *MANYCHAT"), categoria: null };
    expect(ehDaAssinatura("PG *MANYCHAT 10/2026", many)).toBe(true);
    expect(ehDaAssinatura("NETFLIX.COM", many)).toBe(false);
    const r = juntarAssinaturas({ dela: [many], achadas: [], contas: [], recusas: new Set(), lancamentosDoMes: [{ descricao: "PG *MANYCHAT", valor: 899 }] });
    expect(r[0].pagaEsteMes).toBe(true);
  });

  it("o vencimento é o dia dela neste mês; sem dia, o último dia do mês", () => {
    const hoje = new Date(Date.UTC(2026, 1, 10));
    expect(vencimentoDaAssinatura(31, hoje).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(vencimentoDaAssinatura(5, hoje).toISOString().slice(0, 10)).toBe("2026-02-05");
    expect(vencimentoDaAssinatura(null, hoje).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("conta no gasto da semana como fixo", () => {
  it("enquanto não sai, fica reservada inteira; quando sai, o comerciante aprendido casa e não conta duas vezes", () => {
    const c = contasDoMes([], 0, [{ valor: 899, categoria: "OUTROS" }], () => false);
    expect(c.total).toBe(899);
    const conta = { nome: "Meu ManyChat", valor: 899, categoria: "OUTROS", comerciante: chaveDoComercianteDe("PG *MANYCHAT") };
    expect(lancamentoDaConta({ descricao: "PG *MANYCHAT 10/2026", subcategoria: null, valor: 912, categoria: "LAZER", comerciante: chaveDoComercianteDe("PG *MANYCHAT 10/2026") }, conta)).toBe(true);
    expect(lancamentoDaConta({ descricao: "PADARIA", subcategoria: null, valor: 12, categoria: "ALIMENTACAO", comerciante: chaveDoComercianteDe("PADARIA") }, conta)).toBe(false);
  });
});

describe("Dinheiro perdido aprende o comerciante que ela marcou", () => {
  it("a cobrança que o motor chamava de hábito vira assinatura, e o aumento aparece", () => {
    const linhas = [l("HOSTINGER BR", 30, "2026-07-10"), l("HOSTINGER BR", 31, "2026-08-10"), l("HOSTINGER BR", 45, "2026-09-10"), l("HOSTINGER BR", 45, "2026-10-10")];
    expect(cacarDinheiroPerdido(linhas).achados.filter((a) => a.tipo === "aumento" || a.tipo === "assinatura")).toEqual([]);
    const chave = chaveDoComercianteDe("HOSTINGER BR")!;
    const r = cacarDinheiroPerdido(linhas, { assinaturasDela: new Set([chave]) });
    expect(r.achados.map((a) => a.tipo)).toContain("aumento");
  });
});
