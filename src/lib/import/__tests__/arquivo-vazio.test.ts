import { describe, expect, it } from "vitest";
import { extractUploadFromForm, UploadReadError } from "../extract-text";

/** Download que não terminou no celular chega com 0 bytes: a mensagem tem que dizer isso. */
describe("arquivo vazio", () => {
  it("avisa que o arquivo chegou vazio em vez de culpar o servidor", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(0)], "fatura-ficticia.pdf"));
    form.set("encoding", "pdf");
    const erro = await extractUploadFromForm(form).catch((e) => e);
    expect(erro).toBeInstanceOf(UploadReadError);
    expect(erro.message).toMatch(/chegou vazio/);
    expect(erro.message).not.toMatch(/neste servidor/);
  });
});
