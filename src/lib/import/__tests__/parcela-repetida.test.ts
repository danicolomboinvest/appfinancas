import { describe, expect, it } from "vitest";
import { acharParcelaExistente, controleDeProjecao, lojaDaParcela, previaDasParcelas, type ParcelaDoArquivo, type ParcelaGravada } from "../parcela-repetida";

/** Índice do mês (ano * 12 + mês - 1). */
const m = (ano: number, mes: number) => ano * 12 + mes - 1;

const linha = (descricao: string, atual: number, mes: number, valor = 100, perfil = "p1"): ParcelaDoArquivo => ({ perfil, descricao, atual, total: 10, valor, mes });

/** O que cada linha projetaria, na ordem do arquivo (o laço de lancarParcelasFuturas). */
function projecoes(arquivo: ParcelaDoArquivo[]): string[] {
  const c = controleDeProjecao(arquivo);
  const feitas: string[] = [];
  for (const p of arquivo) for (let n = p.atual + 1; n <= p.total; n += 1) if (c.projetar(p, n)) feitas.push(`${p.descricao}>${n}`);
  return feitas;
}

describe("a loja da parcela", () => {
  it("é a mesma em todas as parcelas da compra, escritas de qualquer jeito", () => {
    expect(lojaDaParcela("LOJA X PARC 03/10", 10)).toBe(lojaDaParcela("Loja X Parc 7/10", 10));
    expect(lojaDaParcela("Amazon Marketplace Cc (8/10)", 10)).toBe(lojaDaParcela("Amazon Marketplace Cc (9/10)", 10));
  });
});

describe("controleDeProjecao (causa 1: a k e a k+1 da mesma compra)", () => {
  it("só uma linha da compra: projeta todas as seguintes", () => {
    expect(projecoes([linha("LOJA X PARC 03/10", 3, m(2026, 8))])).toHaveLength(7);
  });

  it("a 03/10 e a 04/10 da mesma compra: a 04/10 não é projetada e o rabo sai uma vez", () => {
    const feitas = projecoes([linha("LOJA X PARC 03/10", 3, m(2026, 8)), linha("LOJA X PARC 04/10", 4, m(2026, 9))]);
    expect(feitas).toEqual([5, 6, 7, 8, 9, 10].map((n) => `LOJA X PARC 03/10>${n}`));
  });

  it("a ordem do arquivo não importa: a 04/10 primeiro também dá um rabo só", () => {
    const feitas = projecoes([linha("LOJA X PARC 04/10", 4, m(2026, 9)), linha("LOJA X PARC 03/10", 3, m(2026, 8))]);
    expect(feitas).toHaveLength(6);
  });

  it("o centavo da primeira parcela não separa a compra", () => {
    const feitas = projecoes([{ ...linha("TENIS PARC 01/03", 1, m(2026, 8), 33.34), total: 3 }, { ...linha("TENIS PARC 02/03", 2, m(2026, 9), 33.33), total: 3 }]);
    expect(feitas).toEqual(["TENIS PARC 01/03>3"]);
  });

  it("duas compras iguais de verdade (a mesma parcela duas vezes no arquivo) projetam duas vezes", () => {
    expect(projecoes([linha("LOJA X PARC 03/10", 3, m(2026, 8)), linha("LOJA X PARC 03/10", 3, m(2026, 8))])).toHaveLength(14);
  });

  it("outro valor, outro mês da compra ou outro perfil é outra compra", () => {
    expect(projecoes([linha("LOJA X PARC 03/10", 3, m(2026, 8)), linha("LOJA X PARC 04/10", 4, m(2026, 9), 250)])).toHaveLength(13);
    // A 04/10 de setembro com a compra em julho (não junho): mês da compra diferente.
    expect(projecoes([linha("LOJA X PARC 03/10", 3, m(2026, 8)), linha("LOJA X PARC 04/10", 4, m(2026, 10))])).toHaveLength(13);
    expect(projecoes([linha("LOJA X PARC 03/10", 3, m(2026, 8)), linha("LOJA X PARC 04/10", 4, m(2026, 9), 100, "p2")])).toHaveLength(13);
  });
});

describe("acharParcelaExistente (causa 2: a parcela um mês fora)", () => {
  type P = { id: string; valor: number; projetada: boolean };
  const procurar = (meses: Partial<Record<-1 | 0 | 1, P[]>>, valor = 100) => acharParcelaExistente((d) => meses[d], valor, 10, (p) => p.projetada);

  it("o mês certo primeiro, de qualquer origem", () => {
    expect(procurar({ 0: [{ id: "certo", valor: 100, projetada: false }], [-1]: [{ id: "viz", valor: 100, projetada: true }] })?.id).toBe("certo");
  });

  it("no vizinho, a projetada antes da que veio de verdade", () => {
    expect(procurar({ [-1]: [{ id: "real", valor: 100, projetada: false }], 1: [{ id: "proj", valor: 100, projetada: true }] })?.id).toBe("proj");
  });

  it("a que veio de verdade em outra fatura, um mês fora, também é a mesma parcela", () => {
    expect(procurar({ 1: [{ id: "real", valor: 100, projetada: false }] })?.id).toBe("real");
    expect(procurar({ [-1]: [{ id: "real", valor: 100, projetada: false }] })?.id).toBe("real");
  });

  it("tira da lista o que achou (não serve duas vezes) e não aceita outro valor", () => {
    const lista = [{ id: "a", valor: 100, projetada: false }];
    expect(procurar({ 1: lista })?.id).toBe("a");
    expect(procurar({ 1: lista })).toBeNull();
    expect(procurar({ 0: [{ id: "b", valor: 250, projetada: false }] })).toBeNull();
  });
});

describe("previaDasParcelas (o que um conserto faria no banco)", () => {
  const g = (id: string, descricao: string, mes: number, extra: Partial<ParcelaGravada> = {}): ParcelaGravada => ({ id, dono: "u|p", mes, descricao, valor: 100, semDia: false, projetada: false, ...extra });

  it("a mesma compra com as projetadas em par: sai uma de cada par, as projetadas", () => {
    const gravadas = [
      g("r3", "LOJA X PARC 03/10", m(2026, 8)),
      g("r4", "LOJA X PARC 04/10", m(2026, 9)),
      g("p4", "LOJA X PARC 04/10", m(2026, 9), { projetada: true }),
      g("p5a", "LOJA X PARC 05/10", m(2026, 10), { projetada: true }),
      g("p5b", "LOJA X PARC 05/10", m(2026, 10), { projetada: true }),
    ];
    expect(previaDasParcelas(gravadas)).toEqual([
      { id: "p4", acao: "apagar", causa: "par-no-mesmo-mes", confianca: "alta" },
      { id: "p5b", acao: "apagar", causa: "par-no-mesmo-mes", confianca: "alta" },
    ]);
  });

  it("duas compras iguais de verdade (a parcela veio duas vezes da fatura) não saem", () => {
    const gravadas = [g("a3", "LOJA X PARC 03/10", m(2026, 8)), g("b3", "LOJA X PARC 03/10", m(2026, 8)), g("a4", "LOJA X PARC 04/10", m(2026, 9), { projetada: true }), g("b4", "LOJA X PARC 04/10", m(2026, 9), { projetada: true })];
    expect(previaDasParcelas(gravadas)).toEqual([]);
  });

  it("a mesma parcela em dois meses vizinhos: sai a do lado menor; a que só está nele muda de mês", () => {
    const gravadas = [
      // Modo novo: 03/10 em agosto, 04 e 05 projetadas, com dia.
      g("n3", "LOJA X PARC 03/10", m(2026, 8)),
      g("n4", "LOJA X PARC 04/10", m(2026, 9), { projetada: true }),
      g("n5", "LOJA X PARC 05/10", m(2026, 10), { projetada: true }),
      // Modo antigo, um mês à frente e sem dia: a 03/10 em setembro e a 02/10 em agosto.
      g("v3", "LOJA X PARC 03/10", m(2026, 9), { semDia: true }),
      g("v2", "LOJA X PARC 02/10", m(2026, 8), { semDia: true }),
    ];
    expect(previaDasParcelas(gravadas)).toEqual([
      { id: "v3", acao: "apagar", causa: "mes-vizinho", confianca: "alta" },
      { id: "v2", acao: "mover", causa: "mes-vizinho", confianca: "alta", meses: -1 },
    ]);
  });

  it("dois meses de distância, ou a série que ela recusou, ficam de fora", () => {
    const longe = [g("a", "LOJA X PARC 03/10", m(2026, 8)), g("b", "LOJA X PARC 03/10", m(2026, 10))];
    expect(previaDasParcelas(longe)).toEqual([]);
    const par = [g("a", "LOJA X PARC 04/10", m(2026, 9)), g("b", "LOJA X PARC 04/10", m(2026, 9), { projetada: true }), g("c", "LOJA X PARC 03/10", m(2026, 8))];
    expect(previaDasParcelas(par, () => true)).toEqual([]);
    expect(previaDasParcelas(par)).toHaveLength(1);
  });
});
