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
