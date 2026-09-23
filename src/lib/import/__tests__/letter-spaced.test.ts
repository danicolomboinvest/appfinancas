import { describe, expect, it } from "vitest";
import { isLetterSpacedText, normalizeLetterSpacedText, unspaceLetters } from "../letter-spaced";
import { parseStatement } from "../statement-parser";

/**
 * Fatura FICTÍCIA no mesmo formato da cooperativa que quebrou: todo o PDF sai com uma letra por
 * vez, e a coluna do valor separada por tabulação.
 */
const FATURA_ESPACADA = [
  "P á g i n a 1 d e 3",
  "M A R I A D E E X E M P L O",
  "R E F. : s e t / 2 0 2 6",
  "T O T A L : R $ 1 . 2 3 0 , 5 0 \tV E N C I M E N T O : 1 1 S E T 2 0 2 6",
  "L A N ÇA M E N T O S – VI S A P L AT I N U M 1 2 3 4 * * . * * * * * * . 5 6 7 8",
  "D ATA D E S C R I Ç Ã O \tVA L O R",
  "2 1 / o u t 1 2 3 4 5 6 7 8 L O J A E X E M P L O P a r c . 1 1 / 1 5 \tR $ 2 4 0 , 0 0",
  "0 4 / a g o P O S T O M O D E L O \tR $ 1 0 5 , 3 3",
  "0 6 / a g o P a g a m e n t o R e c e b i d o",
  "1 3 / a g o M E R CA D O D O B A I R R O \tR $ 3 3 , 3 8",
  "T O T A L D E M A R I A \tR $ 1 . 2 3 0 , 5 0",
].join("\n");

describe("PDF escrito letra por letra", () => {
  it("reconhece o arquivo espaçado e deixa um PDF normal em paz", () => {
    expect(isLetterSpacedText(FATURA_ESPACADA)).toBe(true);
    expect(isLetterSpacedText("01/09/2026 MERCADO DO BAIRRO 33,38\n02/09/2026 POSTO MODELO 105,33")).toBe(false);
  });

  it("junta as letras e reabre o espaço onde a palavra virava", () => {
    expect(unspaceLetters("P á g i n a 1 d e 3")).toBe("Página 1 de 3");
    expect(unspaceLetters("0 6 / a g o P a g a m e n t o R e c e b i d o")).toBe("06/ago Pagamento Recebido");
    // A tabulação separa as colunas do PDF e continua onde estava.
    expect(unspaceLetters("0 4 / a g o P O S T O M O D E L O \tR $ 1 0 5 , 3 3")).toBe("04/ago POSTOMODELO\tR$105,33");
  });

  it("não mexe no texto quando o arquivo não é espaçado", () => {
    const normal = "01/09/2026 MERCADO 33,38\n02/09/2026 POSTO 105,33";
    expect(normalizeLetterSpacedText(normal)).toBe(normal);
  });

  it("lê a fatura inteira que antes dava zero lançamentos", () => {
    const transacoes = parseStatement(normalizeLetterSpacedText(FATURA_ESPACADA), "pdf", 2026);
    expect(transacoes).toHaveLength(3);
    // Compra de outubro numa fatura de setembro: o dia e o mês saem do arquivo, o ano é o de
    // referência (a fatura não repete o ano em cada linha).
    expect(transacoes[0].date).toMatch(/-10-21$/);
    expect(transacoes[0].amount).toBe(-240);
    expect(transacoes[0].description).toContain("LOJAEXEMPLO");
    expect(transacoes[1]).toMatchObject({ date: "2026-08-04", amount: -105.33 });
    expect(transacoes[2]).toMatchObject({ date: "2026-08-13", amount: -33.38 });
  });
});
