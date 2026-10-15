import { describe, expect, it } from "vitest";
import { pdfTextQuality } from "../pdf-quality";

describe("pdfTextQuality", () => {
  it("flags a phone-printed statement where only the numbers survived as text", () => {
    const numbersOnly = Array.from({ length: 30 }, (_, i) => `31/08/26 \t${(i + 1) * 1000},32 \t100,00000000 \t10.200,30`).join("\n") + "\nOuvidoria: 0800-770-0190\n";
    expect(pdfTextQuality(numbersOnly)).toBe("numbers-only");
  });

  it("accepts a normal statement and rejects a scanned one", () => {
    expect(pdfTextQuality("PETR4 Petrobras 100 3.500,00\nVALE3 Vale 50 2.900,00\nHGLG11 CSHG Log 10 1.600,00")).toBe("ok");
    expect(pdfTextQuality("\n\n  \n")).toBe("empty");
  });

  it("PDF escaneado de várias páginas: a marca de página não conta como texto", () => {
    const soMarcas = Array.from({ length: 9 }, (_, i) => `\n-- ${i + 1} of 9 --\n`).join("\n");
    expect(pdfTextQuality(soMarcas)).toBe("empty");
    expect(pdfTextQuality("-- 1 of 1 --\nExtrato 01/10 Mercado 12,30")).toBe("ok");
  });
});
