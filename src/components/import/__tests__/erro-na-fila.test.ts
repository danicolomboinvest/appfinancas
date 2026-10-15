import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("fila de vários arquivos: arquivo que não leu", () => {
  const fonte = readFileSync(join(__dirname, "..", "StatementImport.tsx"), "utf8");
  const i = fonte.indexOf("data-erro-da-fila");
  const fim = fonte.indexOf('a.status === "senha"', i);
  const bloco = i === -1 ? "" : fonte.slice(i - 200, fim);

  it("mostra a mensagem em cor de erro legível, não em cinza miúdo", () => {
    expect(bloco).toContain("bg-danger-soft");
    expect(bloco).toMatch(/text-danger">\{a\.erro\}/);
    expect(bloco).not.toContain("text-ink-muted");
  });

  it("traz o botão Falar com o suporte com o nome do arquivo e o problema", () => {
    expect(bloco).toContain("<FalarComSuporte arquivo={a.file.name} problema={a.erro}");
  });
});
