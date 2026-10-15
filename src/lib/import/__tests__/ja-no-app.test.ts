import { describe, expect, it } from "vitest";
import { casarJaNoApp, tituloDoGrupo, TEXTO_JA_NO_APP, type JaNoApp, type LinhaNova } from "../ja-no-app";

let n = 0;
const linha = (description: string, valor: number, date: string, extra: Partial<LinhaNova> = {}): LinhaNova => ({ key: n++, description, valor, date, category: "EXPENSE", ...extra });
const noApp = (description: string | null, amount: number, date: string | null, extra: Partial<JaNoApp> = {}): JaNoApp => ({
  id: `e${n++}`,
  description,
  amount,
  date,
  category: "EXPENSE",
  conta: null,
  ...extra,
});
const casa = (linhas: LinhaNova[], existentes: JaNoApp[], contaDoArquivo: string | null = "cartao:nubank") => casarJaNoApp(linhas, existentes, { contaDoArquivo });

describe("já no app: a) lançamento à mão", () => {
  it("gorjeta de 10% com o nome que bate vira pergunta", () => {
    const l = linha("OUTBACK STEAKHOUSE SP", 110, "2026-10-10");
    const m = noApp("Outback", 100, "2026-10-10");
    expect(casa([l], [m]).get(l.key)).toBe(m);
  });

  it("centavos acima de 1% com o nome que bate vira pergunta", () => {
    const l = linha("PADARIA REAL", 31.5, "2026-10-10");
    const m = noApp("Padaria Real", 30, "2026-10-11");
    expect(casa([l], [m]).get(l.key)).toBe(m);
  });

  it("4 e 5 dias de distância com o nome que bate viram pergunta; 6 não", () => {
    const l4 = linha("ENEL DISTRIBUICAO", 213.29, "2026-10-14");
    const l6 = linha("SABESP", 98, "2026-10-16");
    const r = casa([l4, l6], [noApp("Enel", 213.29, "2026-10-09"), noApp("Sabesp", 98, "2026-10-10")]);
    expect(r.has(l4.key)).toBe(true);
    expect(r.has(l6.key)).toBe(false);
  });

  it("nome diferente exige valor igual", () => {
    const l = linha("CARREFOUR", 152, "2026-10-10");
    expect(casa([l], [noApp("Mercado do mês", 150, "2026-10-10")]).size).toBe(0);
    const l2 = linha("CARREFOUR", 150, "2026-10-10");
    expect(casa([l2], [noApp("Mercado do mês", 150, "2026-10-12")]).size).toBe(1);
  });

  it("nome diferente com valor igual só até 3 dias", () => {
    const l = linha("CARREFOUR", 150, "2026-10-10");
    expect(casa([l], [noApp("Mercado do mês", 150, "2026-10-14")]).size).toBe(0);
  });

  it("mais de 5% com o nome que bate, sem ser gorjeta, não pergunta", () => {
    const l = linha("POSTO SHELL", 180, "2026-10-10");
    expect(casa([l], [noApp("Shell", 200, "2026-10-10")]).size).toBe(0);
  });

  it("gasto não casa com entrada (o tipo)", () => {
    const l = linha("PIX MARIA", 100, "2026-10-10");
    expect(casa([l], [noApp("Pix Maria", 100, "2026-10-10", { category: "INCOME" })]).size).toBe(0);
  });

  it("estorno não casa com compra (o sinal)", () => {
    const l = linha("ESTORNO ZARA", -199, "2026-10-10");
    expect(casa([l], [noApp("Zara", 199, "2026-10-10")]).size).toBe(0);
  });
});

describe("já no app: b) a mesma compra de outro banco ou arquivo", () => {
  it("data da compra × data do débito, em outra conta, vira pergunta", () => {
    const l = linha("MERCADOLIVRE*LOJA", 249.9, "2026-10-08");
    const e = noApp("COMPRA DEBITO MERCADOLIVRE", 249.9, "2026-10-10", { conta: "conta:itau" });
    expect(casa([l], [e]).get(l.key)).toBe(e);
  });

  it("na MESMA conta, dia diferente é outra compra", () => {
    const l = linha("MERCADOLIVRE*LOJA", 249.9, "2026-10-08");
    expect(casa([l], [noApp("MERCADOLIVRE*LOJA", 249.9, "2026-10-10", { conta: "cartao:nubank" })]).size).toBe(0);
  });

  it("compara pelo nome que o banco deu quando ela renomeou", () => {
    const l = linha("AMAZON MARKETPLACE", 89, "2026-10-08");
    const e = noApp("Presente da mãe", 89.5, "2026-10-09", { conta: "conta:inter", descricaoOriginal: "AMAZON BR" });
    expect(casa([l], [e]).get(l.key)).toBe(e);
  });
});

describe("já no app: c) o casal com o mesmo cartão", () => {
  it("o gasto visível do par no mesmo dia vira pergunta, mesmo na mesma conta", () => {
    const l = linha("IFOOD", 64.9, "2026-10-08");
    const e = noApp("IFOOD", 64.9, "2026-10-08", { conta: "cartao:nubank", doPar: true });
    expect(casa([l], [e]).get(l.key)).toBe(e);
  });
});

describe("já no app: c) a fatura do par gravada sem dia", () => {
  it("o mesmo mês da fatura, o nome e o valor iguais viram pergunta", () => {
    const l = linha("IFOOD *RESTAURANTE", 64.9, "2026-09-20", { mesDaFatura: "2026-10" });
    const e = noApp("IFOOD *RESTAURANTE", 64.9, null, { doPar: true, conta: "cartao:nubank", mes: "2026-10" });
    expect(casa([l], [e]).get(l.key)).toBe(e);
  });

  it("sem dia, valor diferente ou outro mês não perguntam", () => {
    const l = linha("IFOOD *RESTAURANTE", 64.9, "2026-09-20", { mesDaFatura: "2026-10" });
    expect(casa([l], [noApp("IFOOD *RESTAURANTE", 66, null, { doPar: true, mes: "2026-10" })]).size).toBe(0);
    expect(casa([l], [noApp("IFOOD *RESTAURANTE", 64.9, null, { doPar: true, mes: "2026-12" })]).size).toBe(0);
  });

  it("três ônibus do par e quatro na fatura: três perguntas, um entra", () => {
    const linhas = ["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"].map((d) => linha("SPTRANS", 4.4, d, { mesDaFatura: "2026-10" }));
    const doPar = [1, 2, 3].map(() => noApp("SPTRANS", 4.4, null, { doPar: true, mes: "2026-10" }));
    expect(casa(linhas, doPar).size).toBe(3);
  });
});

describe("já no app: os falsos positivos ficam de fora", () => {
  it("duas compras iguais no mesmo arquivo nunca viram pergunta entre si", () => {
    const a = linha("METRO SP", 5.4, "2026-10-08");
    const b = linha("METRO SP", 5.4, "2026-10-08");
    expect(casa([a, b], []).size).toBe(0);
  });

  it("o ônibus que se repete no arquivo só casa no mesmo dia", () => {
    const linhas = ["2026-10-11", "2026-10-12", "2026-10-13"].map((d) => linha("SPTRANS ONIBUS", 4.4, d));
    // O app já tem o ônibus do dia 10, de outro arquivo.
    const r = casa(linhas, [noApp("SPTRANS ONIBUS", 4.4, "2026-10-10", { conta: "conta:itau" })]);
    expect(r.size).toBe(0);
  });

  it("o café que se repete no app (mesma conta) só casa no mesmo dia", () => {
    const l = linha("STARBUCKS", 18, "2026-10-12");
    const existentes = ["2026-10-09", "2026-10-10"].map((d) => noApp("STARBUCKS", 18, d, { conta: "conta:itau" }));
    expect(casa([l], existentes).size).toBe(0);
  });

  it("cada lançamento do app casa com uma linha só", () => {
    const a = linha("NETFLIX.COM", 55.9, "2026-10-08");
    const b = linha("NETFLIX.COM", 55.9, "2026-10-08");
    const r = casa([a, b], [noApp("Netflix", 55.9, "2026-10-08")]);
    // Repete no arquivo: só no mesmo dia, e só UMA vaga.
    expect(r.size).toBe(1);
  });

  it("a linha já resolvida por outra regra gasta a vaga do par dela antes", () => {
    const resolvida = linha("UBER TRIP", 15, "2026-10-10", { resolvida: true });
    const nova = linha("UBER TRIP", 15.5, "2026-10-12");
    const r = casa([resolvida, nova], [noApp("Uber", 15, "2026-10-10", { conta: "conta:itau" })]);
    expect(r.size).toBe(0);
  });
});

describe("já no app: o texto", () => {
  it("é o aprovado, sem travessão", () => {
    expect(TEXTO_JA_NO_APP).toBe("Essa movimentação parece já estar no app. Importar mesmo assim?");
    expect(tituloDoGrupo(3)).toBe("3 parecem já estar no app");
    expect(tituloDoGrupo(1)).toBe("Parece já estar no app");
    expect(`${TEXTO_JA_NO_APP}${tituloDoGrupo(2)}`).not.toMatch(/[—–]/);
  });
});
