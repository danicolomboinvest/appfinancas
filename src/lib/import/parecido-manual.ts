import { chaveDoComerciante, semAcentoNemPontuacao } from "./comerciante";

/**
 * A linha do arquivo é um lançamento que ela JÁ fez à mão?
 *
 * Antes (03/10/2026) havia uma segunda regra, frouxa: gasto até 7 dias e até 15% de diferença,
 * sem olhar o nome. Numa fatura de 94 compras ela casava qualquer coisa com qualquer coisa:
 * Loungekey R$ 192,40 com a Enel de R$ 213,29, Zara com "Jantar fora", Uber com "Bilhete único",
 * a churrascaria com a Sabesp. A Dani (13/10/2026): "é sério que está perguntando isso?".
 *
 * Agora só conta o que é quase certo:
 * - valor igual (até R$ 0,01), ou até 1% quando o nome bate;
 * - data a até 3 dias (lançamento sem dia: o mesmo mês, e aí o nome precisa bater);
 * - nome parecido, ou o lançamento à mão não tem nome que diga algo ("Gasto", vazio).
 * Quase certo ("certo") o app resolve sozinho: a linha não entra de novo e o lançamento à mão
 * fica com o dia do arquivo. Valor igual e data perto com nome diferente ("Mercado" × "Carrefour")
 * é a única dúvida de verdade, e vira UMA pergunta na fila de perguntas.
 *
 * Puro, sem banco: import-actions busca os lançamentos e aplica o resultado.
 */

const DIA_MS = 86_400_000;

export type LancamentoAMao = {
  id: string;
  category: string;
  /** Com sinal, como está no banco (estorno é negativo). */
  amount: number;
  /** "AAAA-MM-DD" ou null quando ela lançou sem dia. */
  entryDate: string | null;
  year: number;
  month: number;
  description: string | null;
};

export type LinhaDoArquivo = {
  key: number;
  /** "AAAA-MM-DD". */
  date: string;
  description: string;
  /** Com sinal, do jeito que seria gravado (estorno negativo). */
  valor: number;
  category: string;
};

export type CasamentoComAMao = { tipo: "certo" | "duvida"; manual: LancamentoAMao };

/** Palavras que não dizem de onde veio o gasto: "Gasto", "Compra no cartão", "Pix". */
const SEM_NOME = new Set([
  "gasto", "gastos", "compra", "compras", "despesa", "despesas", "outro", "outros", "outra", "outras", "sem", "descricao",
  "lancamento", "lancamentos", "cartao", "credito", "debito", "pix", "valor", "conta", "pagamento", "pago", "paguei",
  "de", "da", "do", "no", "na", "em", "com", "e", "a", "o", "um", "uma", "teste", "x", "item", "coisa", "coisas", "diversos",
]);

/** Palavras que aparecem em todo nome e não provam nada sozinhas. */
const COMUNS = new Set([
  "de", "da", "do", "das", "dos", "no", "na", "em", "com", "para", "pra", "e", "a", "o", "the", "and",
  "ltda", "sa", "me", "eireli", "epp", "br", "com", "www", "sao", "paulo", "rio", "janeiro", "brasil",
  "loja", "bar", "restaurante", "posto", "lanche", "mercado", "supermercado", "farmacia", "drogaria", "conta", "pagamento",
  "compra", "pix", "enviado", "recebido", "cartao", "debito", "credito", "online", "app", "store", "shop",
]);

/** O lançamento à mão não tem nome que diga de onde veio: vazio, só número, ou só palavra genérica. */
export function semNomeUtil(descricao: string | null | undefined): boolean {
  const palavras = semAcentoNemPontuacao(descricao ?? "").replace(/\*/g, " ").split(" ").filter(Boolean);
  return palavras.every((p) => p.length < 2 || /^\d+$/.test(p) || SEM_NOME.has(p));
}

function palavrasDoNome(descricao: string): string[] {
  const chave = chaveDoComerciante(descricao) || semAcentoNemPontuacao(descricao);
  return chave
    .replace(/\*/g, " ")
    .split(" ")
    .filter((p) => p.length >= 3 && !/^\d+$/.test(p) && !COMUNS.has(p));
}

/**
 * O nome do arquivo e o que ela escreveu à mão falam do mesmo lugar? Uma palavra de nome em comum
 * ("Netflix" × "NETFLIX.COM"), ou uma grudada na outra ("Ifood" × "IFOODRESTAURANTE"). Palavra
 * curta (3 letras) só vale inteira: "bar" não pega "barbearia".
 */
export function nomeParecido(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const pa = palavrasDoNome(a);
  const pb = palavrasDoNome(b);
  if (pa.length === 0 || pb.length === 0) return false;
  for (const x of pa) {
    for (const y of pb) {
      if (x === y) return true;
      const [curta, longa] = x.length <= y.length ? [x, y] : [y, x];
      if (curta.length >= 4 && longa.startsWith(curta)) return true;
    }
  }
  const juntoA = pa.join("");
  const juntoB = pb.join("");
  return pb.some((y) => y.length >= 5 && juntoA.includes(y)) || pa.some((x) => x.length >= 5 && juntoB.includes(x));
}

function diasEntre(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DIA_MS;
}

/** O que esta linha é deste lançamento à mão: "certo", "duvida" ou nada. */
export function comparar(linha: LinhaDoArquivo, manual: LancamentoAMao): "certo" | "duvida" | null {
  if (manual.category !== linha.category) return null;
  if (!Number.isFinite(Date.parse(`${linha.date}T12:00:00Z`))) return null;
  const diferenca = Math.abs(manual.amount - linha.valor);
  const valorIgual = diferenca <= 0.01 + 1e-9;
  const nomeBate = nomeParecido(linha.description, manual.description);
  const valorQuase = !valorIgual && nomeBate && Math.sign(manual.amount) === Math.sign(linha.valor) && diferenca <= Math.abs(linha.valor) * 0.01 + 1e-9;
  if (!valorIgual && !valorQuase) return null;
  if (manual.entryDate) {
    if (diasEntre(manual.entryDate, linha.date) > 3) return null;
  } else {
    // Sem dia: o mesmo mês, e o nome tem que dizer que é o mesmo.
    if (manual.year !== Number(linha.date.slice(0, 4)) || manual.month !== Number(linha.date.slice(5, 7))) return null;
    return nomeBate ? "certo" : null;
  }
  if (nomeBate || (valorIgual && semNomeUtil(manual.description))) return "certo";
  return valorIgual ? "duvida" : null;
}

/**
 * Casa as linhas do arquivo com os lançamentos à mão. Cada lançamento casa com UMA linha, e cada
 * linha com um lançamento. Primeiro os certos (o mais perto na data ganha), depois as dúvidas.
 */
export function casarComLancadosAMao(linhas: LinhaDoArquivo[], manuais: LancamentoAMao[]): Map<number, CasamentoComAMao> {
  const resultado = new Map<number, CasamentoComAMao>();
  const usados = new Set<string>();
  for (const tipo of ["certo", "duvida"] as const) {
    const pares: { linha: LinhaDoArquivo; manual: LancamentoAMao; dias: number; dif: number }[] = [];
    for (const linha of linhas) {
      if (resultado.has(linha.key)) continue;
      for (const manual of manuais) {
        if (usados.has(manual.id) || comparar(linha, manual) !== tipo) continue;
        pares.push({ linha, manual, dias: manual.entryDate ? diasEntre(manual.entryDate, linha.date) : 15, dif: Math.abs(manual.amount - linha.valor) });
      }
    }
    pares.sort((a, b) => a.dif - b.dif || a.dias - b.dias);
    for (const p of pares) {
      if (resultado.has(p.linha.key) || usados.has(p.manual.id)) continue;
      usados.add(p.manual.id);
      resultado.set(p.linha.key, { tipo, manual: p.manual });
    }
  }
  return resultado;
}
