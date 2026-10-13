import { describe, expect, it } from "vitest";
import { assinatura, destinoDe, planejarMigracao, type LancamentoDoCasal, type RetratoDaCasa } from "@/lib/casa/migracao";

/** O plano da migração do Nós dois para o Casal simples, com a casa da Ana e do Lucas (Lucas = B). */

let n = 0;
const L = (o: Partial<LancamentoDoCasal>): LancamentoDoCasal => ({
  id: `l${++n}`,
  userId: "ana",
  pessoa: "A",
  soMeu: false,
  doCasal: true,
  category: "EXPENSE",
  amount: 100,
  year: 2026,
  month: 10,
  entryDate: "2026-10-05",
  description: "Mercado",
  externalId: null,
  metaDoCasal: false,
  categoriaPersonalizada: null,
  ...o,
});

const base = (lancamentos: LancamentoDoCasal[], extra: Partial<RetratoDaCasa> = {}): RetratoDaCasa => ({
  membroId: "m1",
  casalProfileId: "casal",
  titularId: "ana",
  parId: "lucas",
  letraPar: "B",
  nomes: { titular: "Ana", par: "Lucas" },
  pessoalTitular: "pessoal-ana",
  pessoalPar: null,
  lancamentos,
  externosNoDestino: { titular: [], par: [] },
  assinaturasNoDestino: { titular: [], par: [] },
  preservados: { acertos: ["2026-09"], fechamentos: 1, metas: 2, orcamentos: 5, lotes: 0 },
  ...extra,
});

describe("para onde vai cada lançamento", () => {
  const r = { titularId: "ana", parId: "lucas", letraPar: "B" as const };
  it("o gasto vai para quem pagou (a pessoa A ou B)", () => {
    expect(destinoDe({ userId: "ana", pessoa: "A", soMeu: false }, r)).toBe("titular");
    expect(destinoDe({ userId: "ana", pessoa: "B", soMeu: false }, r)).toBe("par");
    expect(destinoDe({ userId: "ana", pessoa: null, soMeu: false }, r)).toBe("titular");
  });
  it("o Só meu fica com quem lançou, mesmo marcado para a outra pessoa", () => {
    expect(destinoDe({ userId: "ana", pessoa: "B", soMeu: true }, r)).toBe("titular");
    expect(destinoDe({ userId: "lucas", pessoa: "B", soMeu: true }, r)).toBe("par");
  });
  it("registro de uma terceira conta não vai para ninguém", () => {
    expect(destinoDe({ userId: "estranha", pessoa: "A", soMeu: false }, r)).toBeNull();
  });
});

describe("o plano da casa", () => {
  it("separa, conta, mantém o Só meu e o fora do acerto, e cria o Pessoal que falta", () => {
    const p = planejarMigracao(
      base([
        L({ amount: 2400, description: "Aluguel" }),
        L({ pessoa: "B", amount: 500, description: "Condomínio" }),
        L({ pessoa: "B", category: "INCOME", amount: 6300, doCasal: null, description: "Salário" }),
        L({ pessoa: "A", doCasal: false, amount: 120, description: "Smart Fit" }),
        L({ soMeu: true, doCasal: false, amount: 180, description: "Calça" }),
        L({ userId: "lucas", pessoa: "B", soMeu: true, doCasal: false, amount: 90, description: "Presente" }),
      ]),
    );
    expect(p.contagem.paraTitular).toEqual({ quantos: 3, gasto: 2700, entrada: 0 });
    expect(p.contagem.paraPar).toEqual({ quantos: 3, gasto: 590, entrada: 6300 });
    expect(p.contagem.soMeu).toEqual({ titular: 1, par: 1 });
    expect(p.contagem.daPessoaForaDoAcerto).toBe(1);
    expect(p.movimentos.filter((m) => m.soMeu).map((m) => m.destino).sort()).toEqual(["par", "titular"]);
    expect(p.criarPessoal).toEqual({ titular: false, par: true });
    expect(p.preservados.acertos).toEqual(["2026-09"]);
  });

  it("o aporte de meta a dois fica com a meta, e o que já está no Pessoal (mesmo id do banco) não duplica", () => {
    const p = planejarMigracao(
      base([L({ category: "INVESTMENT_CONTRIBUTION", metaDoCasal: true, amount: 300 }), L({ externalId: "pluggy:1" }), L({ externalId: "pluggy:2" })], {
        externosNoDestino: { titular: ["pluggy:1"], par: [] },
      }),
    );
    expect(p.ficam.map((f) => f.motivo).sort()).toEqual(["já existe no Pessoal", "meta a dois"]);
    expect(p.movimentos).toHaveLength(1);
  });

  it("avisa de possível repetido e leva a categoria personalizada com o mesmo nome", () => {
    const repetido = L({ description: "Internet Vivo", amount: 150, entryDate: "2026-10-04" });
    const p = planejarMigracao(
      base([repetido, L({ pessoa: "B", categoriaPersonalizada: { id: "cc1", nome: "Pet" } }), L({ pessoa: "B", categoriaPersonalizada: { id: "cc1", nome: "Pet" } })], {
        assinaturasNoDestino: { titular: [assinatura({ ...repetido, description: "internet  vivo" })], par: [] },
      }),
    );
    expect(p.possiveisRepetidos).toEqual([expect.objectContaining({ id: repetido.id, destino: "titular", valor: 150 })]);
    expect(p.categorias).toEqual([{ destino: "par", nome: "Pet", deId: "cc1" }]);
  });
});
