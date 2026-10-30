import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * "Zara (02/03)" na lista de lançamentos e na do cartão (pedido de cliente, 30/10/2026). A parcela
 * fica num pedaço que não quebra no meio; o nome continua quebrando linha em vez de cortar com "…"
 * a 320 px (regra da Dani).
 */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

describe("a parcela ao lado do nome, sem cortar o nome", () => {
  it("o pedaço da parcela não quebra no meio e é discreto", () => {
    const fonte = ler("src/components/entries/NomeComParcela.tsx");
    expect(fonte).toMatch(/whitespace-nowrap/);
    expect(fonte).toMatch(/text-ink-muted/);
    expect(fonte).toContain("({parcela})");
  });
  it.each(["src/app/(app)/orcamento/cartao/SeusCartoes.tsx", "src/app/(app)/orcamento/cartao/page.tsx"])("%s mostra a parcela e quebra linha em vez de cortar", (arquivo) => {
    const fonte = ler(arquivo);
    expect(fonte).toMatch(/NomeComParcela/);
    expect(fonte).not.toMatch(/\btruncate\b/);
  });
  it("a lista de lançamentos mantém o nome quebrando linha e a parcela sem quebrar", () => {
    const fonte = ler("src/app/(app)/mensal/[year]/[month]/EntryList.tsx");
    expect(fonte).toMatch(/break-words text-\[16px\] leading-snug text-ink">\s*\{titulo\}\s*\{parcela && <span className="ml-1.5 whitespace-nowrap/);
  });
});
