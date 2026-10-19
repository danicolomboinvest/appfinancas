import { parseInstallment } from "@/lib/entries/recurrence";
import { diaAnterior, diaDoIso, diaNoMes, diasValidos, faturaDe, faturaSeguinte, isoDoDia, somarMesesAoMes, type Dia } from "./fatura";

/**
 * Compra parcelada lançada à mão no Digitar (18/10/2026, a Dani, a partir do pedido de uma
 * cliente): com Gasto e um cartão escolhido em "Como pagou?", "Em quantas vezes?". O valor
 * digitado é o TOTAL da compra; viram N lançamentos, um em cada fatura seguinte do cartão, como a
 * fatura importada já faz com as parcelas projetadas. Só a regra, sem banco: para testar.
 */

export const MAX_PARCELAS = 24;

/** As vezes que valem: inteiro de 1 a 24. Qualquer outra coisa vira 1 (à vista). */
export function parcelasValidas(n: unknown): number {
  const v = typeof n === "string" ? Number(n) : n;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_PARCELAS ? v : 1;
}

/**
 * O total em centavos dividido em `n` parcelas. A 1ª absorve os centavos que sobram, como os
 * bancos fazem e como o resto do app já espera (R$ 100 em 3x = 33,34 + 33,33 + 33,33; ver
 * `mesmaParcela` em lib/entries/recurrence.ts). A soma bate exatamente com o total.
 */
export function dividirEmParcelas(totalCentavos: number, n: number): number[] {
  const vezes = parcelasValidas(n);
  const total = Math.max(0, Math.round(totalCentavos));
  const base = Math.floor(total / vezes);
  return Array.from({ length: vezes }, (_, i) => (i === 0 ? total - base * (vezes - 1) : base));
}

/** A linha do Digitar: quanto é cada parcela e, quando a 1ª é diferente, quanto é a 1ª. */
export function resumoDasParcelas(totalCentavos: number, n: number): { vezes: number; parcela: number; primeira: number | null } {
  const partes = dividirEmParcelas(totalCentavos, n);
  const parcela = partes[partes.length - 1] ?? 0;
  return { vezes: partes.length, parcela, primeira: partes[0] !== parcela ? partes[0] : null };
}

/**
 * "Celular (1/12)": o "N/T" entre parênteses, que parseInstallment já lê como parcela certa. Se a
 * descrição dela já tem um "N/T" (uma data, "Loja 03/09"), vai "(parcela 1/3)": o app lê o número
 * depois de "parcela" antes de qualquer outro, e a data não vira parcela 3 de 9.
 */
export function descricaoDaParcela(base: string, numero: number, total: number): string {
  const nome = base.trim().replace(/\s*\((?:parcela\s+)?\d{1,2}\s*\/\s*\d{1,2}\s*\)\s*$/i, "");
  const curta = `${nome} (${numero}/${total})`.trim();
  const lida = parseInstallment(curta);
  return lida?.confident && lida.current === numero && lida.total === total ? curta : `${nome} (parcela ${numero}/${total})`.trim();
}

export type ParcelaNoMes = {
  /** 1 a N. */
  numero: number;
  /** O mês em que a parcela conta no orçamento (o da fatura, decisão da Dani de 15/10/2026). */
  year: number;
  month: number;
  /** A data gravada na parcela ("AAAA-MM-DD"): o dia da compra no mês da parcela, como a fatura importada faz. */
  data: string;
};

/**
 * Em que mês cada parcela conta e com que data fica. Com os dias do cartão: a 1ª na fatura da
 * compra (a mesma regra do gasto à vista, `faturaDe`), cada seguinte na fatura seguinte. A data
 * de cada uma é o dia da compra no mês dela (31 vira o último dia do mês curto); se esse dia
 * cair em outra fatura (fechamento perto do fim do mês), vira a véspera do fechamento da fatura
 * dela, para a tela do cartão somar a parcela na fatura certa. Sem os dias do cartão: uma por
 * mês a partir do mês da compra.
 */
export function parcelasNasFaturas(dataDaCompra: string, n: number, cartao: { diaFechamento: number | null; diaVencimento: number | null } | null): ParcelaNoMes[] {
  const compra = diaDoIso(dataDaCompra);
  if (!compra) return [];
  const vezes = parcelasValidas(n);
  const noMes = (k: number): Dia => {
    const m = somarMesesAoMes(compra.ano, compra.mes, k);
    return diaNoMes(m.ano, m.mes, compra.dia);
  };
  if (!cartao || !diasValidos(cartao)) {
    return Array.from({ length: vezes }, (_, k) => {
      const d = noMes(k);
      return { numero: k + 1, year: d.ano, month: d.mes, data: isoDoDia(d) };
    });
  }
  const dias = cartao;
  const primeira = faturaDe(compra, dias);
  const out: ParcelaNoMes[] = [];
  let fatura = primeira;
  for (let k = 0; k < vezes; k++) {
    if (k > 0) fatura = faturaSeguinte(fatura, dias);
    let dia = k === 0 ? compra : noMes(k);
    if (faturaDe(dia, dias).chave !== fatura.chave) dia = diaAnterior(fatura.fechamento);
    out.push({ numero: k + 1, year: fatura.ano, month: fatura.mes, data: isoDoDia(dia) });
  }
  return out;
}

/**
 * "Esta e as próximas" (18/10/2026, a Dani): ao apagar uma parcela, as da MESMA compra
 * (parcelamentoId) desta em diante, pelo mês em que cada uma conta (o da fatura). As que já
 * passaram ficam. Sem parcelamentoId, só ela mesma. Só a regra: quem chama já trouxe só as
 * linhas da dona (userId e perfil).
 */
export function parcelasDaquiPraFrente<T extends { id: string; parcelamentoId: string | null; year: number; month: number }>(base: T, linhas: T[]): T[] {
  if (!base.parcelamentoId) return [base];
  const chave = (l: { year: number; month: number }) => l.year * 12 + l.month;
  return linhas
    .filter((l) => l.parcelamentoId === base.parcelamentoId && chave(l) >= chave(base))
    .sort((a, b) => chave(a) - chave(b));
}
