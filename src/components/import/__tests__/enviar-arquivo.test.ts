import { describe, expect, it, vi } from "vitest";

const cliente = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@vercel/blob/client", () => cliente);

import { ArquivoNaoAbriu, comNovaTentativa, erroComOArquivo, montarEnvio, nomeParaOArmazenamento } from "../enviar-arquivo";

const MB = 1024 * 1024;

describe("envio do arquivo da importação", () => {
  it("arquivo pequeno vai dentro do formulário, já lido para a memória", async () => {
    const file = new File(["data;valor\n01/10;10,00"], "extrato.csv", { type: "text/csv" });
    const form = await montarEnvio(file, { docType: "extrato", encoding: "text" });
    const enviado = form.get("file") as File;
    expect(enviado).not.toBe(file);
    expect(enviado.name).toBe("extrato.csv");
    expect(await enviado.text()).toBe(await file.text());
    expect(form.get("docType")).toBe("extrato");
    expect(form.get("blob")).toBeNull();
    expect(cliente.upload).not.toHaveBeenCalled();
  });

  it("arquivo grande vai pelo armazenamento, na pasta da pessoa, e o formulário leva só o caminho", async () => {
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, pasta: "importar/u1/" }))) as typeof fetch;
    cliente.upload.mockResolvedValue({ pathname: "importar/u1/Extrato-Itau-xyz.pdf" });
    try {
      const file = new File([new Uint8Array(9 * MB)], "Extrato Itaú.pdf", { type: "application/pdf" });
      const form = await montarEnvio(file, { docType: "fatura", encoding: "pdf" });
      expect(cliente.upload).toHaveBeenCalledWith("importar/u1/Extrato-Itau.pdf", expect.any(File), expect.objectContaining({ access: "private", handleUploadUrl: "/api/importar/envio" }));
      expect(form.get("file")).toBeNull();
      expect(form.get("blob")).toBe("importar/u1/Extrato-Itau-xyz.pdf");
      expect(form.get("nomeDoArquivo")).toBe("Extrato Itaú.pdf");
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it("arquivo que o celular não entrega vira erro do arquivo, não da internet", async () => {
    const quebrado = new File(["x"], "extrato.pdf");
    quebrado.arrayBuffer = () => Promise.reject(new DOMException("The requested file could not be read", "NotReadableError"));
    await expect(montarEnvio(quebrado, {})).rejects.toBeInstanceOf(ArquivoNaoAbriu);
  });

  it("conexão que cai é tentada de novo uma vez; outro erro não", async () => {
    let vezes = 0;
    const r = await comNovaTentativa(async () => {
      vezes++;
      if (vezes === 1) throw new TypeError("Failed to fetch");
      return "lido";
    }, 0);
    expect(r).toBe("lido");
    expect(vezes).toBe(2);

    let outra = 0;
    await expect(comNovaTentativa(async () => { outra++; throw new Error("quebrou"); }, 0)).rejects.toThrow("quebrou");
    expect(outra).toBe(1);
  });

  it("nome seguro para o caminho e registro com tipo e faixa de tamanho (sem nome do arquivo)", () => {
    expect(nomeParaOArmazenamento("Fatura Março (1).PDF")).toBe("Fatura-Marco-1-.PDF");
    expect(nomeParaOArmazenamento("...")).toBe("arquivo");
    const e = erroComOArquivo(new TypeError("Failed to fetch"), new File([new Uint8Array(5 * MB)], "Extrato da Ana.pdf"));
    expect(`${e.name}: ${e.message}`).toBe("TypeError: Failed to fetch [pdf, acima de 4 MB]");
  });
});
