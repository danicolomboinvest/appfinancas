import { describe, expect, it } from "vitest";
import { UPLOAD_MAX_BYTES } from "../limites";

/**
 * O teto real é da Vercel, não do app: corpo de requisição acima de ~4,5 MB volta 413 antes de
 * o servidor rodar, sem deixar diagnóstico. Enquanto o app barrava em 7,5 MB, todo arquivo nessa
 * faixa era aceito na tela e sumia em silêncio, com a mensagem culpando a internet da pessoa.
 * Este teste existe pra que subir o número de novo doa aqui, e não no WhatsApp de uma cliente.
 */
const TETO_DA_VERCEL = 4.5 * 1024 * 1024;

describe("limite de tamanho do upload", () => {
  it("fica abaixo do teto da Vercel, com folga pro embrulho do multipart", () => {
    expect(UPLOAD_MAX_BYTES).toBeLessThan(TETO_DA_VERCEL);
    expect(TETO_DA_VERCEL - UPLOAD_MAX_BYTES).toBeGreaterThanOrEqual(256 * 1024);
  });

  it("ainda cabe um extrato de banco normal", () => {
    expect(UPLOAD_MAX_BYTES).toBeGreaterThanOrEqual(3 * 1024 * 1024);
  });
});

describe("arquivo grande pelo armazenamento (19/10/2026)", () => {
  it("até 4 MB vai direto; de 4 a 25 MB vai pelo armazenamento; acima disso não vai", async () => {
    const { vaiPeloArmazenamento, ARQUIVO_MAX_BYTES } = await import("../limites");
    expect(vaiPeloArmazenamento(3 * 1024 * 1024)).toBe(false);
    expect(vaiPeloArmazenamento(UPLOAD_MAX_BYTES)).toBe(false);
    expect(vaiPeloArmazenamento(8 * 1024 * 1024)).toBe(true);
    expect(vaiPeloArmazenamento(15 * 1024 * 1024)).toBe(true);
    expect(vaiPeloArmazenamento(ARQUIVO_MAX_BYTES + 1)).toBe(false);
  });
});
