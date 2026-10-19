import { beforeEach, describe, expect, it, vi } from "vitest";

const blobs = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn(), list: vi.fn() }));
vi.mock("@vercel/blob", () => blobs);

import { ArquivoGrandeSumiu, apagarArquivosGrandesEsquecidos, trazerArquivoGrande } from "../arquivo-grande";

function noArmazenamento(bytes: Uint8Array, tipo = "application/pdf") {
  return { statusCode: 200, stream: new Response(bytes).body, headers: new Headers(), blob: { size: bytes.length, contentType: tipo } };
}

describe("arquivo grande vindo do armazenamento", () => {
  beforeEach(() => {
    blobs.get.mockReset();
    blobs.del.mockReset().mockResolvedValue(undefined);
  });

  it("sem caminho, não mexe no formulário", async () => {
    const form = new FormData();
    form.set("file", new File(["a"], "a.csv"));
    await trazerArquivoGrande(form, "u1");
    expect(blobs.get).not.toHaveBeenCalled();
    expect((form.get("file") as File).name).toBe("a.csv");
  });

  it("busca, põe no lugar do arquivo com o nome de verdade e apaga do armazenamento", async () => {
    const bytes = new Uint8Array(9 * 1024 * 1024).fill(7);
    blobs.get.mockResolvedValue(noArmazenamento(bytes));
    const form = new FormData();
    form.set("blob", "importar/u1/Extrato-Itau-abc123.pdf");
    form.set("nomeDoArquivo", "Extrato Itaú.pdf");
    await trazerArquivoGrande(form, "u1");
    const file = form.get("file") as File;
    expect(file.name).toBe("Extrato Itaú.pdf");
    expect(file.size).toBe(bytes.length);
    expect(file.type).toBe("application/pdf");
    expect(form.get("blob")).toBeNull();
    expect(blobs.del).toHaveBeenCalledWith("importar/u1/Extrato-Itau-abc123.pdf");
  });

  it("não lê o arquivo de outra pessoa", async () => {
    const form = new FormData();
    form.set("blob", "importar/u2/extrato.pdf");
    await expect(trazerArquivoGrande(form, "u1")).rejects.toBeInstanceOf(ArquivoGrandeSumiu);
    const fora = new FormData();
    fora.set("blob", "importar/u1/../u2/extrato.pdf");
    await expect(trazerArquivoGrande(fora, "u1")).rejects.toBeInstanceOf(ArquivoGrandeSumiu);
    expect(blobs.get).not.toHaveBeenCalled();
  });

  it("arquivo que já não está lá vira 'sumiu' (a tela manda de novo)", async () => {
    blobs.get.mockResolvedValue(null);
    const form = new FormData();
    form.set("blob", "importar/u1/x.pdf");
    await expect(trazerArquivoGrande(form, "u1")).rejects.toBeInstanceOf(ArquivoGrandeSumiu);
  });

  it("acima de 25 MB não é lido, e é apagado", async () => {
    blobs.get.mockResolvedValue({ ...noArmazenamento(new Uint8Array(1)), blob: { size: 26 * 1024 * 1024, contentType: "application/pdf" } });
    const form = new FormData();
    form.set("blob", "importar/u1/x.pdf");
    await expect(trazerArquivoGrande(form, "u1")).rejects.toBeInstanceOf(ArquivoGrandeSumiu);
    expect(blobs.del).toHaveBeenCalled();
  });

  it("a faxina apaga só o que ficou mais de 1 hora", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "teste";
    const agora = Date.parse("2026-10-19T12:00:00Z");
    blobs.list.mockResolvedValue({
      hasMore: false,
      blobs: [
        { url: "https://x/velho", uploadedAt: new Date(agora - 2 * 3_600_000) },
        { url: "https://x/novo", uploadedAt: new Date(agora - 60_000) },
      ],
    });
    expect(await apagarArquivosGrandesEsquecidos(agora)).toBe(1);
    expect(blobs.del).toHaveBeenCalledWith(["https://x/velho"]);
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });
});
