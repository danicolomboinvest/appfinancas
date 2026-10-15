import type { ParentCategory } from "@prisma/client";
import type { ConfirmedItem } from "@/app/(app)/mensal/import-actions";
import type { CompraSemValorEmReal } from "./print-fatura";

/**
 * Compra em dólar (euro, libra) num print da fatura aberta: o print só mostra "US$ 19,00", sem o
 * real. A tela de revisão deixa ela digitar o valor em real; só então a compra entra. O valor de
 * fora fica guardado nos campos de "outra moeda" do lançamento (originalAmount/originalCurrency),
 * e o nome da loja continua limpo.
 */

export type MoedaDeFora = "USD" | "EUR" | "GBP";

/** A compra pendente, já com a categoria que o app sugere (a mesma regra das outras linhas). */
export type CompraParaPreencher = CompraSemValorEmReal & {
  parentCategory: ParentCategory | null;
  customCategoryId: string | null;
  subcategory: string | null;
};

/** Só as três moedas que o leitor de print conhece; qualquer outra coisa vira null. */
export function moedaDeForaValida(valor: unknown): MoedaDeFora | null {
  return valor === "USD" || valor === "EUR" || valor === "GBP" ? valor : null;
}

/** Os campos de "outra moeda" do lançamento. Vazio quando falta a moeda ou o valor em real. */
export function conversaoDaCompra(
  de: { moeda: unknown; valor: number } | null | undefined,
  reais: number,
): { originalAmount?: number; originalCurrency?: string; exchangeRate?: number } {
  const moeda = moedaDeForaValida(de?.moeda);
  if (!de || !moeda || !(de.valor > 0) || !(reais > 0)) return {};
  return { originalAmount: de.valor, originalCurrency: moeda, exchangeRate: Math.round((reais / de.valor) * 1e6) / 1e6 };
}

/** O valor em real que ela digitou (reais, positivo e com limite); null quando ainda não preencheu. */
export function reaisDigitados(valor: number | undefined | null): number | null {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0 || valor >= 1e7) return null;
  return Math.round(valor * 100) / 100;
}

/** As compras em moeda de fora que ela preencheu viram linhas confirmadas; as vazias ficam de fora. */
export function confirmadasDaMoedaDeFora(compras: CompraParaPreencher[], digitados: Record<number, number | undefined>): ConfirmedItem[] {
  return compras.flatMap((c, i) => {
    const reais = reaisDigitados(digitados[i]);
    if (reais === null) return [];
    const moedaDeFora = moedaDeForaValida(c.moeda) ? { moeda: c.moeda as MoedaDeFora, valor: c.valorDeFora } : null;
    return [{
      date: c.data,
      description: c.nome,
      amount: reais,
      category: "EXPENSE" as const,
      parentCategory: c.customCategoryId ? null : (c.parentCategory ?? "OUTROS"),
      customCategoryId: c.customCategoryId,
      subcategory: c.subcategory,
      learn: false,
      installment: null,
      profileId: null,
      estorno: false,
      resgate: false,
      ...(moedaDeFora ? { moedaDeFora } : {}),
    }];
  });
}

/** Soma do que ela já preencheu: entra na conta do "bate com o total da fatura". */
export function somaDigitada(digitados: Record<number, number | undefined>, quantas: number): number {
  let total = 0;
  for (let i = 0; i < quantas; i += 1) total += reaisDigitados(digitados[i]) ?? 0;
  return Math.round(total * 100) / 100;
}
