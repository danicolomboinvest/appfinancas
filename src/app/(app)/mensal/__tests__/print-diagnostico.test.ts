import { describe, expect, it, vi } from "vitest";

/**
 * Print que quebra no leitor de imagem (14/10/2026): o tesseract rejeitou com texto, não com
 * Error, e o diagnóstico de 18 falhas dizia só "exceção: erro".
 */
const recordImportDiagnostic = vi.fn<(d: { message?: string }) => Promise<string>>(async () => "d1");
const storeFailedImportFile = vi.fn(async (...args: [{ diagnosticId?: string | null; encoding?: string | null; reason: string }]) => void args);
vi.mock("@/lib/repositories/import-file.repo", () => ({ storeFailedImportFile }));
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

  it("guarda a imagem do print que não deu, ligada ao diagnóstico", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    storeFailedImportFile.mockClear();
    const form = new FormData();
    form.set("file", new File([new Uint8Array([137, 80, 78, 71])], "print.png", { type: "image/png" }));
    form.set("envio", "2026-10-14");
    await lerPrintDaFaturaAction(form);
    expect(storeFailedImportFile).toHaveBeenCalledTimes(1);
    expect(storeFailedImportFile.mock.calls[0][0]).toMatchObject({ diagnosticId: "d1", encoding: "imagem", reason: "falha" });
  });
});
