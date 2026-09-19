import type { ParsedTransaction } from "./statement-parser";

/**
 * Freio contra leitura errada: o app olha o resultado da própria leitura e pergunta "isso aqui
 * parece dinheiro de gente?" antes de deixar gravar.
 *
 * Existe por um caso real. Quatro clientes importaram o extrato e os números entraram errados:
 * "TV POR ASSINATURA" virou uma receita de R$ 8.159.526, um PIX ENVIADO entrou como entrada, e
 * o app inteiro passou a mostrar número errado pra elas — orçamento, saúde financeira, gráfico.
 * Ninguém percebeu por dias.
 *
 * O mecanismo exato continua desconhecido (os arquivos não foram guardados, porque na época só
 * se guardava o que FALHAVA). Coluna trocada e separador decimal perdido explicam partes do que
 * ficou no banco, nenhuma das duas explica tudo. Por isso estes sinais não tentam adivinhar a
 * causa: olham só o formato do resultado, que é o que dá pra afirmar.
 *
 * O que estes sinais têm em comum é que nenhum depende de conhecer o banco: valem pra qualquer
 * formato que o app ainda não viu, inclusive os que vão aparecer depois. Nada aqui bloqueia a
 * importação — a pessoa continua dona da decisão —, mas ela vê o aviso antes de confirmar, em
 * vez de descobrir semanas depois que o mês dela está errado.
 */

export type Suspeita = {
  /** Frase curta, pra tela. */
  texto: string;
  /** Exemplos concretos do que puxou a suspeita, pra pessoa reconhecer na hora. */
  exemplos: string[];
};

/** Acima disto não é gasto de pessoa física: é coluna errada ou conta de empresa. */
export const VALOR_FORA_DE_ESCALA = 200_000;

export function checarPlausibilidade(
  txns: ParsedTransaction[],
  docType: "extrato" | "fatura" | string,
): Suspeita[] {
  const suspeitas: Suspeita[] = [];
  if (txns.length === 0) return suspeitas;

  const money = (n: number) => `R$ ${Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;

  // 1. Valor fora de escala. Um só já basta pra desconfiar do arquivo inteiro.
  const gigantes = txns.filter((t) => Math.abs(t.amount) > VALOR_FORA_DE_ESCALA);
  if (gigantes.length > 0) {
    suspeitas.push({
      texto: `${gigantes.length === 1 ? "Um lançamento tem" : `${gigantes.length} lançamentos têm`} valor fora de escala. Quase sempre é o app lendo o arquivo errado — coluna trocada ou vírgula perdida.`,
      exemplos: gigantes.slice(0, 3).map((t) => `${(t.description ?? "").slice(0, 34)} — ${money(t.amount)}`),
    });
  }

  // 2. Extrato em que quase tudo entrou como ENTRADA. Extrato de verdade tem os dois lados;
  //    quando o sinal se perde, o mês vira uma renda gigante que a pessoa nunca teve.
  if (docType === "extrato" && txns.length >= 5) {
    const entradas = txns.filter((t) => t.amount > 0).length;
    if (entradas / txns.length >= 0.9) {
      suspeitas.push({
        texto: `${entradas} de ${txns.length} lançamentos entraram como ENTRADA de dinheiro. Num extrato normal também tem saída — o sinal pode ter se perdido na leitura.`,
        exemplos: txns
          .filter((t) => t.amount > 0 && /pix enviado|pagamento|compra|d[ée]bito|tarifa|boleto/i.test(t.description ?? ""))
          .slice(0, 3)
          .map((t) => `${(t.description ?? "").slice(0, 34)} — entrou como +${money(t.amount)}`),
      });
    }
  }

  // 3. Valores sem centavo nenhum. Dinheiro de extrato quase sempre tem centavo; número de
  //    documento, de autenticação e valor lido sem a vírgula nunca têm. É o sinal que pega a
  //    leitura torta mesmo quando os valores são pequenos demais pra chamar atenção sozinhos.
  if (txns.length >= 8) {
    const redondos = txns.filter((t) => Math.round(Math.abs(t.amount) * 100) % 100 === 0).length;
    if (redondos / txns.length >= 0.9) {
      suspeitas.push({
        texto: `Nenhum dos ${txns.length} valores tem centavos. Isso costuma indicar que o app pegou a coluna errada do arquivo, ou perdeu a vírgula dos centavos.`,
        exemplos: txns.slice(0, 3).map((t) => `${(t.description ?? "").slice(0, 34)} — ${money(t.amount)}`),
      });
    }
  }

  return suspeitas;
}
