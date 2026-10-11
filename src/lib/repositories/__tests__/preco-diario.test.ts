import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
vi.mock("@/lib/db/prisma", () => ({ prisma: { precoDiario: { upsert: (...a: unknown[]) => upsert(...a) } } }));

import { gravarPrecosDoDia } from "../preco-diario.repo";

describe("gravarPrecosDoDia", () => {
  beforeEach(() => upsert.mockReset().mockResolvedValue({}));
  const dia = new Date(Date.UTC(2026, 9, 11));

  it("grava um preço por ticker no dia, em maiúsculas, e ignora quem não teve preço", async () => {
    const n = await gravarPrecosDoDia(new Map([["mxrf11", 9.62], ["HGLG11", null], ["ITSA4", 0]]), "investidor10", dia);
    expect(n).toBe(1);
    expect(upsert).toHaveBeenCalledWith({
      where: { ticker_data: { ticker: "MXRF11", data: dia } },
      update: { preco: 9.62, fonte: "investidor10" },
      create: { ticker: "MXRF11", data: dia, preco: 9.62, moeda: "BRL", fonte: "investidor10" },
    });
  });

  it("um ticker que falha não segura os outros", async () => {
    upsert.mockRejectedValueOnce(new Error("x"));
    const n = await gravarPrecosDoDia(new Map([["ITSA4", 10.6], ["BBAS3", 24.2]]), "investidor10", dia);
    expect(n).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});
