import { describe, expect, it } from "vitest";
import { linhasDaLista } from "../linhas";
import type { CasaNaSessao } from "@/lib/casa/regras";

/** A lista de Transações no Casal simples: de quem é cada linha, e o cadeado só no que é meu e está escondido. */

const casa: CasaNaSessao = {
  membroId: "m",
  casalProfileId: "c",
  eu: { userId: "ana", profileId: "pa", letra: "A", nome: "Ana", papel: "titular" },
  outro: { userId: "lucas", profileId: "pl", letra: "B", nome: "Lucas", papel: "par" },
};

const base = {
  year: 2026, month: 10, category: "EXPENSE" as const, parentCategory: null, customCategoryId: null, subcategory: null, description: "x", amount: 10,
  entryDate: null, goalId: null, recurrenceId: null, pessoa: null, doCasal: null, noCartao: null, divididoCom: null, parteDeOutro: null, devolvidoEm: null,
  originalCurrency: null, originalAmount: null, exchangeRate: null, importBatchId: null,
};
type Linha = Parameters<typeof linhasDaLista>[0][number];
const L = (o: Record<string, unknown>) => ({ ...base, ...o }) as unknown as Linha;

describe("linhas da lista no Casal simples", () => {
  const quem = { userId: "ana", profileId: "pa", casa };
  it("marca de quem é e põe o cadeado no que é meu e escondido", () => {
    const [meu, soMeu, contaEscondida, doLucas] = linhasDaLista(
      [
        L({ id: "1", userId: "ana", soMeu: false, importBatch: null }),
        L({ id: "2", userId: "ana", soMeu: true, importBatch: null }),
        L({ id: "3", userId: "ana", soMeu: false, importBatch: { docType: "extrato", ocultoDoPar: true } }),
        L({ id: "4", userId: "lucas", soMeu: false, importBatch: { docType: "extrato", ocultoDoPar: false } }),
      ],
      false,
      quem,
    );
    expect([meu.dono, meu.escondido]).toEqual(["eu", false]);
    expect([soMeu.escondido, soMeu.soMeu]).toEqual([true, true]);
    expect([contaEscondida.escondido, contaEscondida.soMeu]).toEqual([true, false]);
    expect([doLucas.dono, doLucas.escondido]).toEqual(["outro", false]);
  });

  it("sem casa nada muda: sem dono e sem cadeado", () => {
    const [l] = linhasDaLista([L({ id: "1", userId: "ana", soMeu: true, importBatch: null })], false, { userId: "ana", profileId: "pa" });
    expect([l.dono, l.escondido]).toEqual([null, false]);
  });
});
