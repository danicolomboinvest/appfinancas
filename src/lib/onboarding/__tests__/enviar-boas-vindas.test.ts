import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Quem enviou um extrato, teve o arquivo lido e nunca confirmou a importação não recebe os e-mails
 * de "app vazio" (decisão da Dani em 14/10/2026). Banco de mentira, nenhum e-mail de verdade.
 */
let diagnosticos: { userId: string; stage: "parse" | "confirm"; ok: boolean }[] = [];
const travas: string[] = [];

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    importDiagnostic: {
      findFirst: async ({ where }: { where: { userId: string; stage: "parse" | "confirm"; ok: boolean } }) =>
        diagnosticos.find((d) => d.userId === where.userId && d.stage === where.stage && d.ok === where.ok) ?? null,
    },
    notificationLog: {
      create: async ({ data }: { data: { key: string } }) => {
        if (travas.includes(data.key)) throw new Error("duplicado");
        travas.push(data.key);
      },
      deleteMany: async () => ({ count: 0 }),
    },
    financialProfile: { findFirst: async () => null },
  },
}));

const { enviarEtapaComConta, enviouArquivoSemConfirmar } = await import("../enviar-boas-vindas");
const user = { id: "u1", email: "ana@exemplo.com", name: "Ana" };

beforeEach(() => {
  diagnosticos = [];
  travas.length = 0;
});

describe("quem enviou extrato e parou antes de confirmar", () => {
  it("não recebe e-mail nenhum da trilha de app vazio, e a trava não é gravada", async () => {
    diagnosticos = [{ userId: "u1", stage: "parse", ok: true }];
    const enviar = vi.fn(async () => ({ ok: true }) as never);
    for (const etapa of ["boas-vindas-vazio-dia2", "boas-vindas-vazio-dia5"] as const) {
      expect(await enviarEtapaComConta(user, etapa, "https://app.test", enviar)).toBe("pulado");
    }
    expect(enviar).not.toHaveBeenCalled();
    expect(travas).toEqual([]);
  });
  it("as boas-vindas em si continuam saindo para ela", async () => {
    diagnosticos = [{ userId: "u1", stage: "parse", ok: true }];
    const enviar = vi.fn(async () => ({ ok: true }) as never);
    expect(await enviarEtapaComConta(user, "boas-vindas", "https://app.test", enviar)).toBe("enviado");
    expect(enviar).toHaveBeenCalledTimes(1);
  });
  it("quem confirmou alguma importação, ou não enviou nada, segue com o texto de sempre", async () => {
    for (const d of [[], [{ userId: "u1", stage: "parse" as const, ok: true }, { userId: "u1", stage: "confirm" as const, ok: true }]]) {
      diagnosticos = d;
      travas.length = 0;
      expect(await enviouArquivoSemConfirmar("u1")).toBe(false);
      const enviar = vi.fn(async () => ({ ok: true }) as never);
      expect(await enviarEtapaComConta(user, "boas-vindas-vazio-dia2", "https://app.test", enviar)).toBe("enviado");
      expect(enviar.mock.calls).toHaveLength(1);
    }
  });
  it("leitura que falhou não conta como extrato enviado", async () => {
    diagnosticos = [{ userId: "u1", stage: "parse", ok: false }];
    expect(await enviouArquivoSemConfirmar("u1")).toBe(false);
  });
});
