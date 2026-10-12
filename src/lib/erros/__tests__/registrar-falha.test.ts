import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
vi.mock("@/lib/db/prisma", () => ({ prisma: { appError: { upsert: (...a: unknown[]) => upsert(...a) } } }));
const { registrarFalhaDaAcao } = await import("../registrar-falha");

describe("falha devolvida pela ação vai para o AppError", () => {
  beforeEach(() => upsert.mockReset());
  it("agrupa por onde e mensagem", async () => {
    await registrarFalhaDaAcao("lancar", "Escolha uma categoria pro gasto. [parentCategory]");
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { routePath_message: { routePath: "ação: lancar", message: "Escolha uma categoria pro gasto. [parentCategory]" } } }));
  });
  it("se o banco falhar, não derruba quem chamou", async () => {
    upsert.mockRejectedValueOnce(new Error("sem banco"));
    await expect(registrarFalhaDaAcao("lancar", "x")).resolves.toBeUndefined();
  });
});
