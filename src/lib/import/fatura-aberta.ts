import { faturaDe, type DiasDoCartao } from "@/lib/cartao/fatura";
import { parseInstallment } from "@/lib/entries/recurrence";
import { semAcentoNemPontuacao } from "./comerciante";
import { nomeParecido } from "./parecido-manual";
import { semelhanca } from "./print-fatura";

/**
 * A compra que já entrou pelo PRINT da fatura aberta, chegando de novo (13/10/2026).
 *
 * Quem manda prints durante o mês e depois sobe o PDF da fatura fechada não pode ficar com a
 * compra em dobro. O PDF é a verdade (valor, dia e nome do banco); o print foi a prévia. Então a
 * linha do PDF que casa com uma compra do print NÃO entra de novo: a compra do print passa para o
 * lote da fatura fechada e fica com o valor, o dia e o nome dela. Entra só o que faltava (IOF,
 * anuidade, compra depois do último print). Vale também de print para print: o print novo da
 * mesma fatura atualiza o que o anterior já trouxe.
 *
 * Casa quando é quase certo:
 * - valor igual (até R$ 0,01), ou até 1% quando o nome bate (o OCR troca um centavo);
 * - compra com dia: até 2 dias de diferença (a compra aparece no app no dia, e na fatura no dia
 *   em que o banco processou);
 * - parcela (sem dia): a mesma parcela N/T, no mesmo mês ou no vizinho;
 * - nome parecido (o print mostra "iFood", a fatura "IFD*RESTAURANTE SABOR").
 *
 * Puro: import-actions busca as compras dos lotes de print e aplica o resultado.
 */

const DIA_MS = 86_400_000;

export type CompraDoPrintGravada = {
  id: string;
  /** Com sinal, como está no banco (estorno negativo). */
  amount: number;
  /** "AAAA-MM-DD"; null na parcela. */
  entryDate: string | null;
  year: number;
  month: number;
  description: string | null;
};

export type LinhaQueChega = {
  key: number;
  /** "AAAA-MM-DD" (a data da compra, como veio no arquivo). */
  date: string;
  description: string;
  /** Com sinal, do jeito que seria gravado (estorno negativo). */
  valor: number;
};

function nomeBate(a: string, b: string | null): boolean {
  if (!b) return false;
  if (nomeParecido(a, b)) return true;
  const x = semAcentoNemPontuacao(a).replace(/[\s*]|\b(parcela|parc)\b|\d+\/\d+/g, "");
  const y = semAcentoNemPontuacao(b).replace(/[\s*]|\b(parcela|parc)\b|\d+\/\d+/g, "");
  return x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x) || semelhanca(x, y) >= 0.7);
}

function diasEntre(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DIA_MS;
}

/** É a mesma compra? Devolve a "distância" (menor = mais perto) ou null. */
export function mesmaCompra(linha: LinhaQueChega, gravada: CompraDoPrintGravada): number | null {
  if (Math.sign(linha.valor) !== Math.sign(gravada.amount)) return null;
  const diferenca = Math.abs(linha.valor - gravada.amount);
  const nome = nomeBate(linha.description, gravada.description);
  if (!nome) return null;
  if (diferenca > 0.011 && diferenca > Math.abs(linha.valor) * 0.01 + 0.001) return null;
  const parcelaLinha = parseInstallment(linha.description);
  const parcelaGravada = parseInstallment(gravada.description);
  if (parcelaLinha || parcelaGravada) {
    // Parcela só casa com a MESMA parcela: a 3/10 de setembro não é a 4/10 de outubro.
    if (!parcelaLinha || !parcelaGravada || parcelaLinha.current !== parcelaGravada.current || parcelaLinha.total !== parcelaGravada.total) return null;
  }
  if (gravada.entryDate && Number.isFinite(Date.parse(`${linha.date}T12:00:00Z`))) {
    const dias = diasEntre(gravada.entryDate, linha.date);
    if (dias > 2) return null;
    return dias + diferenca;
  }
  // Sem dia (parcela): o mesmo mês ou o vizinho. A fatura fechada costuma escrever a data da
  // compra ORIGINAL; a parcela k cai k - 1 meses depois dela.
  const m = Number(linha.date.slice(0, 4)) * 12 + Number(linha.date.slice(5, 7));
  const g = gravada.year * 12 + gravada.month;
  const k = (parcelaLinha?.current ?? 1) - 1;
  const distancia = Math.min(Math.abs(g - m), Math.abs(g - (m + k)));
  if (!Number.isFinite(distancia) || distancia > 1) return null;
  return distancia * 3 + diferenca;
}

/** Cada linha casa com UMA compra do print e cada compra com uma linha; a mais perto ganha. */
export function casarComFaturaAberta(linhas: LinhaQueChega[], gravadas: CompraDoPrintGravada[]): Map<number, CompraDoPrintGravada> {
  const pares: { key: number; g: CompraDoPrintGravada; d: number }[] = [];
  for (const l of linhas) {
    for (const g of gravadas) {
      const d = mesmaCompra(l, g);
      if (d !== null) pares.push({ key: l.key, g, d });
    }
  }
  pares.sort((a, b) => a.d - b.d);
  const resultado = new Map<number, CompraDoPrintGravada>();
  const usadas = new Set<string>();
  for (const p of pares) {
    if (resultado.has(p.key) || usadas.has(p.g.id)) continue;
    resultado.set(p.key, p.g);
    usadas.add(p.g.id);
  }
  return resultado;
}

/**
 * A revisão pode prometer "as seguintes entram sozinhas nos próximos meses"? Só quando a
 * gravação de fato lança as seguintes: parcela com certeza, não a última, e NÃO vinda de print da
 * fatura aberta (o print não projeta; quem projeta é a fatura fechada, ver importTransactionsAction).
 */
export function prometeParcelasSeguintes(installment: { current: number; total: number; confident: boolean } | null | undefined, faturaAberta: boolean): boolean {
  return !!installment?.confident && installment.current < installment.total && !faturaAberta;
}

/**
 * As compras dos prints de ANTES que o print de hoje não trouxe de novo (19/10/2026, a Dani: "se
 * teve uma compra ontem e hoje o print é pequeno"). O total do topo da fatura aberta soma tudo
 * desde o fechamento; sem estas, o print pequeno de hoje dizia "Faltam R$ X" sem faltar nada.
 *
 * Com o cartão (dias de fechamento), só as da mesma fatura de hoje, e `certo`. Sem cartão, as dos
 * últimos 40 dias, sem certeza: a tela só diz que bateu, nunca que falta. Parcela sem dia também
 * tira a certeza. `usadas`: as que o print de hoje já casou (contam lá, não aqui).
 */
export function printsAnterioresDaFatura(
  gravadas: CompraDoPrintGravada[],
  usadas: Set<string>,
  hoje: string,
  cartao: DiasDoCartao | null,
): { soma: number; certo: boolean } | null {
  const ate = Date.parse(`${hoje}T12:00:00Z`);
  const comoDia = (iso: string) => ({ ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)), dia: Number(iso.slice(8, 10)) });
  const faturaDeHoje = cartao ? faturaDe(comoDia(hoje), cartao).chave : null;
  let soma = 0;
  let certo = cartao !== null;
  let achou = false;
  for (const g of gravadas) {
    if (usadas.has(g.id)) continue;
    if (g.entryDate) {
      const t = Date.parse(`${g.entryDate}T12:00:00Z`);
      if (!(t <= ate && ate - t <= 40 * DIA_MS)) continue;
      if (faturaDeHoje && cartao && faturaDe(comoDia(g.entryDate), cartao).chave !== faturaDeHoje) continue;
    } else {
      const m = Number(hoje.slice(0, 4)) * 12 + Number(hoje.slice(5, 7));
      if (Math.abs(g.year * 12 + g.month - m) > 1) continue;
      certo = false;
    }
    soma += g.amount;
    achou = true;
  }
  return achou ? { soma: Math.round(soma * 100) / 100, certo } : null;
}
