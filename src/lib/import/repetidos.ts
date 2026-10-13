/**
 * Compras iguais no MESMO arquivo (mesmo dia, valor e nome) são reais quase sempre: quatro
 * patinetes de R$ 3 no mesmo dia, dois cashbacks iguais. Antes a tela perguntava "Deixar só 1?"
 * de cada uma, e a Dani (13/10/2026) não quer pergunta disso.
 *
 * O único repetido que não é real é a MESMA linha do arquivo lida duas vezes (erro de leitura).
 * Ele se denuncia pelo texto: o valor aparece no arquivo menos vezes do que as linhas lidas com
 * ele. Só nesse caso as cópias a mais saem, sozinhas e sem perguntar. Sem o valor no texto (foto,
 * formato que escreve diferente), não dá pra provar nada e tudo fica.
 *
 * Puro: recebe o texto do arquivo e as linhas lidas, devolve os índices que saem.
 */

type Lida = { date: string | null; amount: number; description: string | null };

function chave(t: Lida): string {
  return `${t.date ?? ""}|${Math.abs(t.amount).toFixed(2)}|${(t.description ?? "").trim().toLowerCase()}`;
}

/** As formas que o valor pode estar escrito no arquivo: "1.234,56", "1234,56", "1234.56", "1,234.56". */
function formasDoValor(valor: number): string[] {
  const [inteiro, centavos] = Math.abs(valor).toFixed(2).split(".");
  const comPonto = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const comVirgula = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return [...new Set([`${comPonto},${centavos}`, `${inteiro},${centavos}`, `${inteiro}.${centavos}`, `${comVirgula}.${centavos}`])];
}

/** Quantas vezes o valor aparece escrito no texto, como número inteiro (não pedaço de outro). */
export function vezesNoTexto(texto: string, valor: number): number {
  let total = 0;
  const vistos = new Set<number>();
  for (const forma of formasDoValor(valor)) {
    const re = new RegExp(`(?<![\\d.,])${forma.replace(/[.]/g, "\\.")}(?![\\d]|[.,]\\d)`, "g");
    for (const m of texto.matchAll(re)) {
      if (m.index === undefined || vistos.has(m.index)) continue;
      vistos.add(m.index);
      total++;
    }
  }
  return total;
}

/** Os índices das linhas que são a mesma linha do arquivo lida de novo. */
export function lidasEmDobro(texto: string, linhas: Lida[]): Set<number> {
  const grupos = new Map<string, number[]>();
  linhas.forEach((t, i) => grupos.set(chave(t), [...(grupos.get(chave(t)) ?? []), i]));
  const fora = new Set<number>();
  const porValor = new Map<string, number>();
  for (const t of linhas) {
    const v = Math.abs(t.amount).toFixed(2);
    porValor.set(v, (porValor.get(v) ?? 0) + 1);
  }
  for (const indices of grupos.values()) {
    if (indices.length < 2) continue;
    const valor = Math.abs(linhas[indices[0]].amount);
    const noTexto = vezesNoTexto(texto, valor);
    if (noTexto === 0) continue;
    const lidas = porValor.get(valor.toFixed(2)) ?? 0;
    const sobra = Math.min(indices.length - 1, lidas - noTexto);
    if (sobra <= 0) continue;
    for (const i of indices.slice(indices.length - sobra)) fora.add(i);
    porValor.set(valor.toFixed(2), lidas - sobra);
  }
  return fora;
}
