import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regra da Dani: texto nunca cortado com "…"; se não couber (320 px), quebra linha. Nome de ativo,
 * de dívida, de categoria, de arquivo, descrição da linha importada e a frase do acerto do Nós dois
 * (leva de 14/10/2026, refeita em 30/10).
 */
const RAIZ = join(__dirname, "..", "..", "..");
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

describe("nomes não são cortados com reticências", () => {
  it.each([
    "src/app/(app)/carteira/MeusAtivos.tsx",
    "src/app/(app)/dividas/DividasTela.tsx",
    "src/app/(app)/mensal/[year]/[month]/EntryList.tsx",
    "src/app/(app)/mensal/[year]/[month]/FolhaDaTransacao.tsx",
    "src/components/import/StatementImport.tsx",
    "src/components/casal-login/LancamentosDoNossoMes.tsx",
  ])("%s quebra linha em vez de cortar", (arquivo) => {
    expect(ler(arquivo)).not.toMatch(/\btruncate\b|line-clamp-/);
  });

  it("a frase do acerto do Nós dois nos Lançamentos quebra em vez de cortar", () => {
    const linha = ler("src/components/casal-login/LancamentosDoNossoMes.tsx").split("\n").find((l) => l.includes("{fraseAcerto}")) ?? "";
    expect(linha).toMatch(/break-words/);
  });

  it("a Carteira avisa que o ativo citado em 'Uma ideia de onde pôr' é exemplo, não recomendação", () => {
    expect(ler("src/app/(app)/carteira/MeusAtivos.tsx")).toContain("Os ativos citados são exemplos. Isso não é recomendação.");
  });
});
