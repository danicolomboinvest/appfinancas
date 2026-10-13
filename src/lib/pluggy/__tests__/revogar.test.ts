import { beforeEach, describe, expect, it, vi } from "vitest";

/** A revogação na Pluggy é testada com a Pluggy de mentira: nada sai para a internet. */
const deleteItem = vi.fn();
let configurada = true;
vi.mock("../client", () => ({ deleteItem: (id: string) => deleteItem(id), isPluggyConfigured: () => configurada }));

const { revogarNaPluggy } = await import("../revogar");

beforeEach(() => {
  configurada = true;
  deleteItem.mockReset().mockResolvedValue(undefined);
});

describe("revogarNaPluggy", () => {
  it("revoga cada item", async () => {
    await revogarNaPluggy(["a", "b"]);
    expect(deleteItem.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
  });

  it("sem Pluggy configurada ou sem item, não chama nada", async () => {
    await revogarNaPluggy([]);
    configurada = false;
    await revogarNaPluggy(["a"]);
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it("Pluggy lenta ou com erro não segura ninguém", async () => {
    deleteItem.mockImplementation((id: string) => (id === "lento" ? new Promise(() => undefined) : Promise.reject(new Error("fora do ar"))));
    const antes = Date.now();
    await revogarNaPluggy(["lento", "erro"], 50);
    expect(Date.now() - antes).toBeLessThan(1000);
  });
});
