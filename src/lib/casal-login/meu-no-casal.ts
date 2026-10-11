import type { Acerto, Pessoa } from "@/lib/casal/acerto";

/**
 * "O meu no casal" (proposta aprovada, tela d): o pedaço do mês que é de quem está olhando.
 * - Gastei no mês = a minha parte da casa + o que é meu e os dois veem ("do Lucas").
 * - Coloquei na casa = o que eu paguei dos gastos da casa.
 * - No acerto = o que eu mando (ou recebo), a mesma conta do cartão do acerto.
 * O "só meu" fica de fora dos números de propósito: ele não aparece nem para quem lançou num
 * total que o outro também vê na tela do casal.
 *
 * Com os números da Ana canônica, para o Lucas: parte da casa 1.957,50 + do Lucas 82 = 2.039,50
 * (a tela mostra R$ 2.040), coloquei R$ 1.500, mando R$ 458.
 */

export type LinhaDoMeu = { category: string; amount: number; pessoa: string | null; doCasal: boolean | null; soMeu: boolean };

export type MeuNoCasal = {
  letra: Pessoa;
  gasteiNoMes: number;
  minhaParteDaCasa: number;
  doMeuVisivel: number;
  coloqueiNaCasa: number;
  /** Positivo: eu mando isso. Negativo: eu recebo. Zero: quites. */
  noAcerto: number;
  temSoMeu: boolean;
};

export function calcularMeuNoCasal(acerto: Acerto, letra: Pessoa, linhas: LinhaDoMeu[]): MeuNoCasal {
  let doMeuVisivel = 0;
  let temSoMeu = false;
  for (const l of linhas) {
    if (l.category !== "EXPENSE") continue;
    if (l.soMeu) {
      temSoMeu = true;
      continue;
    }
    if (l.doCasal === false && l.pessoa === letra) doMeuVisivel += Math.abs(Number(l.amount) || 0);
  }
  // saldoA positivo: A pagou a mais e B manda. Visto de quem olha:
  const saldoDeQuemOlha = letra === "A" ? acerto.saldoA : -acerto.saldoA;
  const centavos = (v: number) => Math.round(v * 100) / 100;
  return {
    letra,
    minhaParteDaCasa: acerto.parte[letra],
    doMeuVisivel: centavos(doMeuVisivel),
    gasteiNoMes: centavos(acerto.parte[letra] + doMeuVisivel),
    coloqueiNaCasa: acerto.pagou[letra],
    noAcerto: centavos(-saldoDeQuemOlha),
    temSoMeu,
  };
}
