import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import {
  formatMoney,
  toCurrencyCode,
  currencySymbol,
  CURRENCIES,
} from "../money";

const semNbsp = (s: string) => s.replace(/ /g, " ");

describe("formatMoney", () => {
  it("troca o símbolo mas mantém a leitura brasileira dos números", () => {
    // O público é brasileiro: "1.234,56" continua igual em euro, só o símbolo muda. Em en-US
    // viraria "1,234.56", trocando ponto e vírgula de lugar numa tela de finanças.
    expect(semNbsp(formatMoney(1234.56, "BRL"))).toBe("R$ 1.234,56");
    expect(semNbsp(formatMoney(1234.56, "EUR"))).toBe("€ 1.234,56");
    expect(semNbsp(formatMoney(1234.56, "USD"))).toBe("US$ 1.234,56");
  });

  it("arredondar tira os centavos de verdade", () => {
    // `maximumFractionDigits: 0` sozinho não basta: o mínimo padrão de uma moeda é 2 casas.
    expect(semNbsp(formatMoney(2531.49, "BRL", { round: true }))).toBe(
      "R$ 2.531",
    );
    expect(semNbsp(formatMoney(2531.49, "EUR", { round: true }))).toBe(
      "€ 2.531",
    );
  });

  it("compacta para eixos de gráfico", () => {
    expect(
      semNbsp(formatMoney(38_000_000, "BRL", { compact: true })),
    ).toContain("mi");
  });

  it("sem símbolo devolve só o número", () => {
    expect(semNbsp(formatMoney(1234.5, "EUR", { bare: true }))).toBe(
      "1.234,50",
    );
  });

  it("moeda desconhecida ou nula cai no padrão, em vez de quebrar a tela", () => {
    expect(toCurrencyCode(null)).toBe("BRL");
    expect(toCurrencyCode("XPTO")).toBe("BRL");
    expect(toCurrencyCode("EUR")).toBe("EUR");
  });

  it("toda moeda oferecida tem símbolo", () => {
    for (const code of Object.keys(CURRENCIES)) {
      expect(currencySymbol(code as keyof typeof CURRENCIES)).toBeTruthy();
    }
  });
});

/**
 * Trava de regressão. O trabalho de tirar "R$" de 151 lugares só vale se ele não voltar —
 * e ele volta sozinho, porque `toLocaleString("pt-BR", { currency: "BRL" })` é o jeito
 * "óbvio" de formatar dinheiro e vai ser escrito de novo sem ninguém perceber.
 *
 * Arquivos de LEITURA de extrato ficam de fora: eles precisam do "R$" literal porque é o que
 * está escrito no PDF do banco brasileiro que estão interpretando.
 */
describe("ninguém cravou a moeda de novo", () => {
  const PERMITIDO = [
    "src/lib/money.ts",
    "src/lib/__tests__/money.test.ts",
    "src/lib/import/", // interpreta extrato/IRPF de banco brasileiro: o "R$" é do arquivo lido
    "src/lib/analysis/", // raspagem de sites brasileiros de ações/FIIs
    "src/app/(app)/configuracoes/preferencias/", // o seletor de moeda nomeia as opções
    "__tests__",
  ];

  function grep(pattern: string): string[] {
    let out = "";
    try {
      out = execSync(`grep -rn '${pattern}' src || true`, { encoding: "utf8" });
    } catch {
      return [];
    }
    return (
      out
        .split("\n")
        .filter(Boolean)
        .filter(
          (line) =>
            !PERMITIDO.some(
              (allowed) => line.startsWith(allowed) || line.includes(allowed),
            ),
        )
        // Comentários podem citar "R$ 8.500" ao explicar uma decisão — isso é documentação,
        // não moeda cravada na interface.
        .filter((line) => {
          const code = line
            .slice(line.indexOf(":", line.indexOf(":") + 1) + 1)
            .trim();
          return (
            !code.startsWith("//") &&
            !code.startsWith("*") &&
            !code.startsWith("/*") &&
            !code.startsWith("{/*")
          );
        })
    );
  }

  it('não existe currency: "BRL" fora do módulo de moeda', () => {
    expect(grep('currency: "BRL"')).toEqual([]);
  });

  it("não existe R$ escrito à mão na interface", () => {
    expect(grep("R\\$")).toEqual([]);
  });
});
