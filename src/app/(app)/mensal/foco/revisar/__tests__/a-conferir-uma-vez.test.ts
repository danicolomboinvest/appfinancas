import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/session";

const visto = vi.hoisted(() => ({ where: null as unknown }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: async () => ({ name: "Ana Teste" }) },
    importBatch: { count: async () => 0 },
    monthlyEntry: {
      findMany: async ({ where }: { where: unknown }) => {
        visto.where = where;
        return [];
      },
    },
    decisao: { findMany: async () => [] },
  },
}));

import { carregarRevisaoAntigos } from "../dados";

describe("Revisar N lançamentos", () => {
  it("o 'A conferir' não entra também na lista dos antigos (contava duas vezes)", async () => {
    await carregarRevisaoAntigos({ userId: "u", profileId: "p" } as AuthContext);
    expect(JSON.stringify(visto.where)).toContain('{"OR":[{"subcategory":null},{"NOT":{"subcategory":"A conferir"}}]}');
  });
});
