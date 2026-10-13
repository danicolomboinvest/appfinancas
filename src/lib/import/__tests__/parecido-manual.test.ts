import { describe, expect, it } from "vitest";
import { casarComLancadosAMao, comparar, nomeParecido, semNomeUtil, type LancamentoAMao, type LinhaDoArquivo } from "../parecido-manual";
import { lidasEmDobro, vezesNoTexto } from "../repetidos";

let n = 0;
const linha = (description: string, valor: number, date: string): LinhaDoArquivo => ({ key: n++, description, valor, date, category: "EXPENSE" });
const aMao = (description: string | null, amount: number, entryDate: string | null, ym?: string): LancamentoAMao => ({
  id: `m${n++}`,
  description,
  amount,
  entryDate,
  year: Number((entryDate ?? ym)!.slice(0, 4)),
  month: Number((entryDate ?? ym)!.slice(5, 7)),
  category: "EXPENSE",
});

describe("parecido com lançado à mão: os pares do vídeo da Dani (13/10/2026) não casam", () => {
  const pares: [LinhaDoArquivo, LancamentoAMao][] = [
    [linha("Loungekey", 192.4, "2026-08-14"), aMao("Enel", 213.29, "2026-08-15")],
    [linha("Zara", 199, "2026-09-07"), aMao("Jantar fora", 202.84, "2026-09-13")],
    [linha("Park Do Churrasco", 112.5, "2026-08-20"), aMao("Sabesp", 124.31, "2026-08-15")],
    [linha("Uber", 184.7, "2026-08-14"), aMao("Bilhete único (Carol)", 198, "2026-08-09")],
    [linha("Noir", 138, "2026-09-05"), aMao("Internet fibra", 119.9, "2026-09-12")],
    [linha("Pet Shop da Mel - Ração", 206, "2026-08-30"), aMao("Ração", 220, "2026-09-06")],
  ];
  it.each(pares)("%o × %o", (l, m) => {
    expect(comparar(l, m)).toBeNull();
    expect(casarComLancadosAMao([l], [m]).size).toBe(0);
  });

  it("os seis juntos também não casam nada", () => {
    expect(casarComLancadosAMao(pares.map((p) => p[0]), pares.map((p) => p[1])).size).toBe(0);
  });
});

describe("parecido com lançado à mão: o que é quase certo resolve sozinho", () => {
  it("mesmo valor, data perto e nome parecido é certo", () => {
    const l = linha("NETFLIX.COM SAO PAULO", 55.9, "2026-09-10");
    const m = aMao("Netflix", 55.9, "2026-09-08");
    expect(casarComLancadosAMao([l], [m]).get(l.key)).toEqual({ tipo: "certo", manual: m });
  });

  it("mesmo valor e data perto, com o lançamento à mão sem nome, é certo", () => {
    const l = linha("IFD*RESTAURANTE DO DUDU", 80, "2026-09-10");
    expect(comparar(l, aMao("", 80, "2026-09-10"))).toBe("certo");
    expect(comparar(l, aMao("Gasto", 80, "2026-09-11"))).toBe("certo");
  });

  it("até 1% de diferença só quando o nome bate", () => {
    expect(comparar(linha("ENEL DISTRIBUICAO", 213.29, "2026-08-15"), aMao("Enel", 212, "2026-08-15"))).toBe("certo");
    expect(comparar(linha("ZARA BRASIL", 199, "2026-09-07"), aMao("Jantar", 198, "2026-09-07"))).toBeNull();
  });

  it("mesmo valor, data perto, nome diferente vira a única dúvida", () => {
    expect(comparar(linha("CARREFOUR", 150, "2026-09-10"), aMao("Mercado do mês", 150, "2026-09-09"))).toBe("duvida");
  });

  it("mais de 3 dias de distância não casa, mesmo com o mesmo valor e nome", () => {
    expect(comparar(linha("Aluguel imobiliária", 1500, "2026-09-05"), aMao("Aluguel", 1500, "2026-09-10"))).toBeNull();
  });

  it("lançado sem dia: o mesmo mês e o nome batendo", () => {
    expect(comparar(linha("SPOTIFY", 21.9, "2026-09-03"), aMao("Spotify", 21.9, null, "2026-09"))).toBe("certo");
    expect(comparar(linha("UBER", 21.9, "2026-09-03"), aMao("Spotify", 21.9, null, "2026-09"))).toBeNull();
  });

  it("cada lançamento à mão casa com uma linha só; o certo ganha da dúvida", () => {
    const a = linha("SMART FIT", 100, "2026-09-10");
    const b = linha("PADARIA", 100, "2026-09-10");
    const m = aMao("Smart Fit", 100, "2026-09-10");
    const r = casarComLancadosAMao([b, a], [m]);
    expect(r.get(a.key)?.tipo).toBe("certo");
    expect(r.has(b.key)).toBe(false);
  });

  it("nomes", () => {
    expect(nomeParecido("UBER *TRIP", "Uber")).toBe(true);
    expect(nomeParecido("Uber", "Bilhete único")).toBe(false);
    expect(nomeParecido("Park Do Churrasco", "Sabesp")).toBe(false);
    expect(nomeParecido("IFOODRESTAURANTE", "ifood")).toBe(true);
    expect(semNomeUtil("Compra no cartão")).toBe(true);
    expect(semNomeUtil("Jantar fora")).toBe(false);
  });
});

describe("repetidos no arquivo", () => {
  it("patinete 4x no mesmo dia, cada um escrito no arquivo, fica tudo e não pergunta", () => {
    const texto = ["23/08 Jet Patinetes 3,00", "23/08 Jet Patinetes 3,00", "23/08 Jet Patinetes 3,00", "23/08 Jet Patinetes 3,00"].join("\n");
    const linhas = Array.from({ length: 4 }, () => ({ date: "2026-08-23", amount: 3, description: "Jet Patinetes" }));
    expect(lidasEmDobro(texto, linhas).size).toBe(0);
  });

  it("a mesma linha lida duas vezes (o valor só aparece uma vez no texto) sai sozinha", () => {
    const texto = "14/08 Loungekey 192,40\n15/08 Padaria 12,00";
    const linhas = [
      { date: "2026-08-14", amount: 192.4, description: "Loungekey" },
      { date: "2026-08-14", amount: 192.4, description: "Loungekey" },
      { date: "2026-08-15", amount: 12, description: "Padaria" },
    ];
    expect([...lidasEmDobro(texto, linhas)]).toEqual([1]);
  });

  it("valor que não aparece no texto (foto) não prova nada: fica", () => {
    expect(lidasEmDobro("", [{ date: "2026-08-14", amount: 5, description: "X" }, { date: "2026-08-14", amount: 5, description: "X" }]).size).toBe(0);
  });

  it("conta o valor inteiro, não pedaço de outro", () => {
    expect(vezesNoTexto("1.192,40 e 192,40 e 192,401", 192.4)).toBe(1);
    expect(vezesNoTexto("total 1.234,56; csv -1234.56", 1234.56)).toBe(2);
  });
});
