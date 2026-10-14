import { describe, expect, it, vi } from "vitest";

/**
 * Print que quebra no leitor de imagem (14/10/2026): o tesseract rejeitou com texto, não com
 * Error, e o diagnóstico de 18 falhas dizia só "exceção: erro".
 */
const recordImportDiagnostic = vi.fn(async (_: { message?: string }) => "d1");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "pessoal" })) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/repositories/import-diagnostic.repo", async (original) => ({ ...(await original<object>()), recordImportDiagnostic }));
vi.mock("@/lib/import/ocr-print", () => ({
  lerSegmentosDoPrint: vi.fn(async () => {
    throw "Error attempting to read image.";
  }),
}));

const { lerPrintDaFaturaAction } = await import("../import-actions");

describe("print que quebra no leitor", () => {
  it("o diagnóstico guarda o motivo, mesmo quando não vem um Error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const form = new FormData();
    form.set("file", new File([new Uint8Array([137, 80, 78, 71])], "print.png", { type: "image/png" }));
    form.set("envio", "2026-10-14");
    const r = await lerPrintDaFaturaAction(form);
    expect(r.ok).toBe(false);
    expect(recordImportDiagnostic.mock.calls[0][0].message).toContain("Error attempting to read image");
  });
});
