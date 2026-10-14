import { describe, expect, it } from "vitest";
import {
  aplicarPlano,
  desfazerConserto,
  planejarConserto,
  type BancoDoConserto,
  type LancamentoAntigo,
  type NovoLancamento,
  type RegistroDoConserto,
} from "@/lib/import/parcelas-antigas";

let seq = 0;
function l(over: Partial<LancamentoAntigo> & { description: string; year: number; month: number }): LancamentoAntigo {
  seq += 1;
  return {
    id: `e${seq}`,
    userId: "u1",
    profileId: "p1",
    perfilTipo: "PESSOAL",
    category: "EXPENSE",
    parentCategory: "LAZER",
    customCategoryId: null,
    subcategory: null,
    descricaoDoBanco: null,
    amount: 100,
    entryDate: null,
    importBatchId: "lote1",
    loteTipo: "fatura",
    loteAberto: false,
    pessoa: null,
    doCasal: null,
    soMeu: false,
    autorUserId: null,
    noCartao: null,
    divididoCom: null,
    recurrenceId: null,
    externalId: null,
    ...over,
  };
}

/** Banco em memória: a transação trabalha numa cópia e só troca no fim (tudo ou nada). */
class BancoNaMemoria implements BancoDoConserto {
  linhas = new Map<string, { id: string; userId: string; entryDate: string | null; dados?: NovoLancamento }>();
  private n = 0;
  falharNaTransacao: number | null = null;
  private transacoes = 0;
  constructor(iniciais: LancamentoAntigo[]) {
    for (const e of iniciais) this.linhas.set(e.id, { id: e.id, userId: e.userId, entryDate: e.entryDate });
  }
  async transacao<T>(fn: Parameters<BancoDoConserto["transacao"]>[0]): Promise<T> {
    this.transacoes += 1;
    const copia = new Map([...this.linhas].map(([k, v]) => [k, { ...v }]));
    const r = await fn({
      criar: async (itens) =>
        itens.map((dados) => {
          this.n += 1;
          const id = `novo${this.n}`;
          copia.set(id, { id, userId: dados.userId, entryDate: dados.entryDate, dados });
          return id;
        }),
      darDia: async (itens) =>
        itens.flatMap((i) => {
          const x = copia.get(i.id);
          if (!x || x.userId !== i.userId || x.entryDate !== null) return [];
          x.entryDate = i.dia;
          return [i.id];
        }),
      apagar: async (itens) => itens.filter((i) => copia.get(i.id)?.userId === i.userId && copia.delete(i.id)).length,
      tirarDia: async (itens) =>
        itens.filter((i) => {
          const x = copia.get(i.id);
          if (!x || x.userId !== i.userId || x.entryDate !== i.dia) return false;
          x.entryDate = null;
          return true;
        }).length,
    });
    if (this.falharNaTransacao === this.transacoes) throw new Error("caiu");
    this.linhas = copia;
    return r as T;
  }
  foto() {
    return JSON.stringify([...this.linhas.values()].map((x) => [x.id, x.entryDate]).sort());
  }
}

const registroVazio = (): RegistroDoConserto => ({ versao: 1, banco: "local", inicio: "agora", lotes: [] });

describe("planejarConserto", () => {
  it("projeta as parcelas que faltam do BTG (N/T), nos meses seguintes, com a descrição do banco", () => {
    const base = l({ description: "Airbnb * Hm (3/6)", year: 2026, month: 9 });
    const plano = planejarConserto([l({ description: "Airbnb * Hm (2/6)", year: 2026, month: 8 }), base]);
    expect(plano.compras).toHaveLength(1);
    const c = plano.compras[0];
    expect(c.pulada).toBeNull();
    expect(c.criar.map((p) => [p.description, p.year, p.month])).toEqual([
      ["Airbnb * Hm (4/6)", 2026, 10],
      ["Airbnb * Hm (5/6)", 2026, 11],
      ["Airbnb * Hm (6/6)", 2026, 12],
    ]);
    // A marca da importação: o lote da parcela de origem, mesmo valor, perfil e categoria.
    expect(c.criar[0]).toMatchObject({ importBatchId: "lote1", amount: 100, userId: "u1", profileId: "p1", parentCategory: "LAZER" });
  });

  it("cruza o ano", () => {
    const c = planejarConserto([l({ description: "LOJA X (11/12)", year: 2025, month: 12 })]).compras[0];
    expect(c.criar.map((p) => [p.year, p.month, p.description])).toEqual([[2026, 1, "LOJA X (12/12)"]]);
  });

  it("não duplica: a parcela que já existe em qualquer mês, mesmo sem parênteses ou com centavos diferentes", () => {
    const plano = planejarConserto([
      l({ description: "Amazon Marketplace Cc (8/10)", year: 2026, month: 7, amount: 50.01 }),
      l({ description: "Amazon Marketplace Cc (9/10)", year: 2026, month: 8, amount: 50 }),
      // A 10/10 escrita de outro jeito, já lançada (num mês fora do esperado).
      l({ description: "AMAZON MARKETPLACE CC 10/10", year: 2026, month: 10, amount: 50 }),
    ]);
    expect(plano.compras).toHaveLength(1);
    expect(plano.compras[0].criar).toEqual([]);
  });

  it("compra já completa não cria nada", () => {
    const plano = planejarConserto([l({ description: "Loja (1/2)", year: 2026, month: 1 }), l({ description: "Loja (2/2)", year: 2026, month: 2 })]);
    expect(plano.compras[0].criar).toEqual([]);
  });

  it("dá o dia da compra às parcelas sem data (31 num mês de 30 vira 30) e às projetadas", () => {
    const p1 = l({ description: "Loja Y PARC 01/04", year: 2026, month: 5, entryDate: "2026-05-31", importBatchId: "lote0" });
    const p2 = l({ description: "Loja Y PARC 02/04", year: 2026, month: 6 });
    const c = planejarConserto([p1, p2], { incluirJaLidas: true }).compras[0];
    expect(c.darDia).toEqual([{ id: p2.id, userId: "u1", dia: "2026-06-30" }]);
    expect(c.criar.map((p) => [p.description, p.entryDate])).toEqual([
      ["Loja Y PARC 03/04", "2026-07-31"],
      ["Loja Y PARC 04/04", "2026-08-31"],
    ]);
  });

  it("sem dia conhecido na compra, continua sem dia (não inventa)", () => {
    const c = planejarConserto([l({ description: "Loja Z (2/3)", year: 2026, month: 6 })]).compras[0];
    expect(c.darDia).toEqual([]);
    expect(c.semDiaConhecido).toBe(1);
    expect(c.criar[0].entryDate).toBeNull();
  });

  it("nunca mexe no dia que já existe", () => {
    const c = planejarConserto([
      l({ description: "Loja (1/3)", year: 2026, month: 5, entryDate: "2026-05-10" }),
      l({ description: "Loja (2/3)", year: 2026, month: 6, entryDate: "2026-06-20" }),
    ]).compras[0];
    expect(c.darDia).toEqual([]);
  });

  it("pula o ambíguo que parece data", () => {
    const plano = planejarConserto([l({ description: "POSTO SHELL 03/09", year: 2026, month: 9 })]);
    expect(plano.compras).toEqual([]);
    expect(plano.ambiguas).toBe(1);
  });

  it("pula N repetida (duas compras iguais misturadas)", () => {
    const plano = planejarConserto([
      l({ description: "Loja (2/5)", year: 2026, month: 6 }),
      l({ description: "Loja (2/5)", year: 2026, month: 6 }),
    ]);
    expect(plano.compras[0].pulada).toBe("n_repetida");
    expect(plano.compras[0].criar).toEqual([]);
  });

  it("duas compras iguais em épocas diferentes ficam separadas e cada uma projeta o que é dela", () => {
    const plano = planejarConserto([
      l({ description: "Loja (2/3)", year: 2025, month: 2 }),
      l({ description: "Loja (3/3)", year: 2025, month: 3 }),
      l({ description: "Loja (1/3)", year: 2026, month: 6 }),
    ]);
    expect(plano.compras).toHaveLength(2);
    expect(plano.compras.flatMap((c) => c.criar.map((p) => `${p.description} ${p.month}/${p.year}`))).toEqual(["Loja (2/3) 7/2026", "Loja (3/3) 8/2026"]);
  });

  it("pula quando as N não fecham", () => {
    const plano = planejarConserto([
      l({ description: "Loja (2/8)", year: 2026, month: 1 }),
      l({ description: "Loja (3/8)", year: 2026, month: 1 }),
      l({ description: "Loja (4/8)", year: 2026, month: 1 }),
    ]);
    expect(plano.compras.every((c) => c.criar.length === 0)).toBe(true);
    expect(plano.compras.some((c) => c.pulada === "n_nao_fecham")).toBe(true);
  });

  it("aceita a fatura antiga (mês do vencimento) e a nova (mês da compra) misturadas", () => {
    const c = planejarConserto([
      l({ description: "Loja (3/5)", year: 2026, month: 8 }),
      l({ description: "Loja (4/5)", year: 2026, month: 8, entryDate: "2026-08-12" }),
    ]).compras[0];
    expect(c.pulada).toBeNull();
    expect(c.criar.map((p) => [p.description, p.month, p.entryDate])).toEqual([["Loja (5/5)", 9, "2026-09-12"]]);
  });

  it("o que a importação antiga já lia e projetava só ganha dia (a falta pode ser de propósito)", () => {
    const p1 = l({ description: "EBN CANVA - Parcela 4/12", year: 2026, month: 9, entryDate: "2026-09-05" });
    const p2 = l({ description: "Loja W 5 de 6", year: 2026, month: 9 });
    const p3 = l({ description: "Loja V 9/18", year: 2026, month: 9 });
    const plano = planejarConserto([p1, p2, p3]);
    expect(plano.compras.map((c) => c.pulada)).toEqual(["importacao_antiga_ja_projetava", "importacao_antiga_ja_projetava", "importacao_antiga_ja_projetava"]);
    expect(plano.compras.flatMap((c) => c.criar)).toEqual([]);
    expect(planejarConserto([p1], { incluirJaLidas: true }).compras[0].criar).toHaveLength(8);
  });

  it("total acima de 48 nem é lido", () => {
    expect(planejarConserto([l({ description: "FINANCIAMENTO (3/60)", year: 2026, month: 1 })]).compras).toEqual([]);
  });

  it("loja de tudo não passa a categoria adiante", () => {
    const c = planejarConserto([l({ description: "MERCADOLIVRE*LOJA (1/3)", year: 2026, month: 1, parentCategory: "ALIMENTACAO" })]).compras[0];
    expect(c.criar.every((p) => p.parentCategory === null && p.customCategoryId === null)).toBe(true);
  });

  it("lê pelo nome do banco quando ela renomeou", () => {
    const c = planejarConserto([l({ description: "Presente da mãe", descricaoDoBanco: "Loja (1/2)", year: 2026, month: 3 })]).compras[0];
    expect(c.criar.map((p) => p.description)).toEqual(["Loja (2/2)"]);
  });

  it("não projeta o que não veio de fatura importada, mas dá o dia", () => {
    const manual = planejarConserto([l({ description: "Geladeira (2/10)", year: 2026, month: 2, importBatchId: null, loteTipo: null })]).compras[0];
    expect(manual.pulada).toBe("origem_nao_e_fatura");
    expect(manual.criar).toEqual([]);
    const aberta = planejarConserto([l({ description: "Loja (1/3)", year: 2026, month: 2, loteAberto: true })]).compras[0];
    expect(aberta.pulada).toBe("origem_print_fatura_aberta");
  });

  it("pula a compra dividida com alguém", () => {
    expect(planejarConserto([l({ description: "Loja (1/3)", year: 2026, month: 2, divididoCom: "Marina" })]).compras[0].pulada).toBe("dividida_com_alguem");
  });

  it("Casal: a projetada leva quem pagou e o userId da parcela de origem", () => {
    const c = planejarConserto([l({ description: "Loja (1/2)", year: 2026, month: 2, userId: "par", perfilTipo: "CASAL", pessoa: "B" })]).compras[0];
    expect(c.criar[0]).toMatchObject({ userId: "par", pessoa: "B" });
  });

  it("perfis diferentes não se misturam", () => {
    const plano = planejarConserto([
      l({ description: "Loja (1/3)", year: 2026, month: 2, profileId: "p1" }),
      l({ description: "Loja (1/3)", year: 2026, month: 2, profileId: "p2", userId: "u2" }),
    ]);
    expect(plano.compras).toHaveLength(2);
    expect(plano.compras.every((c) => c.criar.length === 2)).toBe(true);
  });

  it("a mesma compra em dois perfis da mesma conta não é projetada em nenhum (só ganha dia)", () => {
    const plano = planejarConserto([
      l({ description: "Iberia (2/10)", year: 2026, month: 6, profileId: "p1", entryDate: "2026-06-04" }),
      l({ description: "Iberia (3/10)", year: 2026, month: 8, profileId: "p2" }),
      l({ description: "Iberia (4/10)", year: 2026, month: 8, profileId: "p2", entryDate: "2026-08-04" }),
      // Outra compra da mesma loja, de outro valor, segue normal.
      l({ description: "Iberia (1/2)", year: 2026, month: 8, profileId: "p2", amount: 900 }),
    ]);
    const iberia = plano.compras.filter((c) => c.valor === 100);
    expect(iberia.map((c) => c.pulada)).toEqual(["mesma_compra_em_outro_perfil", "mesma_compra_em_outro_perfil"]);
    expect(iberia.flatMap((c) => c.darDia).map((d) => d.dia)).toEqual(["2026-08-04"]);
    expect(plano.compras.find((c) => c.valor === 900)!.criar).toHaveLength(1);
  });
});

describe("aplicar e desfazer", () => {
  const cenario = () => [
    l({ description: "Loja A (1/4)", year: 2026, month: 5, entryDate: "2026-05-15" }),
    l({ description: "Loja A (2/4)", year: 2026, month: 6 }),
    l({ description: "Loja B (3/5)", year: 2026, month: 7, userId: "u2", profileId: "p9" }),
    l({ description: "Loja C (1/2)", year: 2026, month: 7, userId: "u3", profileId: "p8", entryDate: "2026-07-02" }),
  ];

  it("aplica em lotes, registra tudo, e desfazer volta exatamente ao que era", async () => {
    const lancs = cenario();
    const banco = new BancoNaMemoria(lancs);
    const antes = banco.foto();
    const plano = planejarConserto(lancs);
    const registro = registroVazio();
    const gravados: number[] = [];
    const r = await aplicarPlano(plano, banco, registro, (reg) => void gravados.push(reg.lotes.length), 1);
    expect(r).toEqual({ criados: 2 + 2 + 1, comDia: 1 });
    expect(gravados).toEqual([1, 2, 3]);
    expect(banco.linhas.get(lancs[1].id)!.entryDate).toBe("2026-06-15");
    // Rodar o plano de novo sobre o banco já consertado não cria nada.
    const depois = [...lancs.map((x) => ({ ...x, entryDate: banco.linhas.get(x.id)!.entryDate })), ...[...banco.linhas.values()].filter((x) => x.dados).map((x) => l({ ...x.dados!, description: x.dados!.description, id: x.id }))];
    expect(planejarConserto(depois).compras.every((c) => c.criar.length === 0 && c.darDia.length === 0)).toBe(true);

    const d = await desfazerConserto(registro, banco);
    expect(d).toEqual({ apagados: 5, semDia: 1 });
    expect(banco.foto()).toBe(antes);
  });

  it("desfazer não tira o dia que ela mudou depois", async () => {
    const lancs = cenario();
    const banco = new BancoNaMemoria(lancs);
    const registro = registroVazio();
    await aplicarPlano(planejarConserto(lancs), banco, registro, () => {});
    banco.linhas.get(lancs[1].id)!.entryDate = "2026-06-03";
    await desfazerConserto(registro, banco);
    expect(banco.linhas.get(lancs[1].id)!.entryDate).toBe("2026-06-03");
  });

  it("lote que cai não grava nada nem entra no registro", async () => {
    const lancs = cenario();
    const banco = new BancoNaMemoria(lancs);
    banco.falharNaTransacao = 2;
    const registro = registroVazio();
    await expect(aplicarPlano(planejarConserto(lancs), banco, registro, () => {}, 1)).rejects.toThrow("caiu");
    expect(registro.lotes).toHaveLength(1);
    const criadosNoBanco = [...banco.linhas.values()].filter((x) => x.dados).length;
    expect(criadosNoBanco).toBe(registro.lotes[0].criados.length);
    await desfazerConserto(registro, banco);
    expect([...banco.linhas.values()].filter((x) => x.dados)).toEqual([]);
  });
});
