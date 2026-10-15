import { ehDoCartao } from "@/lib/cartao/limite";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { formatMoney, isCurrencyCode } from "@/lib/money";
import type { listMonthlyEntries } from "@/lib/repositories/monthly-entry.repo";
import { quemGastou, type QuemLe } from "@/lib/casa/regras";

type Linha = Awaited<ReturnType<typeof listMonthlyEntries>>[number];

function formatRelativeDay(date: Date | null): string | null {
  if (!date) return null;
  const iso = date.toISOString().slice(0, 10);
  const today = nowInBrazil();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (iso === todayIso) return "Hoje";
  if (iso === yesterdayIso) return "Ontem";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function toDateInput(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}


/**
 * Lançamentos do banco no formato da lista de Transações (mês ou período). `quem` (Casal simples):
 * diz de quem é cada linha, para a bolinha, os filtros Eu/par, o cadeado e o "só quem gastou edita".
 */
export function linhasDaLista(entries: Linha[], ocultos: boolean, quem?: QuemLe, daCasa?: ((l: Linha) => boolean) | null) {
  return entries.map((entry) => {
    const dono = quem ? quemGastou(quem, entry) : null;
    return {
    dono,
    // Casal simples: o gasto é da casa (entra no acerto) ou meu. Só existe dentro de uma casa.
    daCasa: dono && daCasa ? daCasa(entry) : null,
    // Casal simples (versão A, 15/10/2026): do par, quem pagou e a divisão própria, do ponto de
    // vista de quem lançou (lib/casa/escolhas.ts). Só dentro de uma casa.
    casal: dono
      ? {
          doPar: Boolean(entry.doPar),
          pagouOPar: Boolean(entry.pagouOPar),
          divisaoPropria: entry.divisaoPropria ?? null,
          parteDeQuemLancou: entry.parteDeQuemLancou === null || entry.parteDeQuemLancou === undefined ? null : Number(entry.parteDeQuemLancou),
        }
      : null,
    // O que é meu e está escondido do par (Só meu, ou a conta desligada) mostra o cadeado. O do
    // par nunca chega aqui escondido: a leitura já tirou.
    escondido: dono === "eu" && (entry.soMeu || Boolean(entry.importBatch?.ocultoDoPar)),
    soMeu: dono === "eu" ? entry.soMeu : false,
    id: entry.id,
    year: entry.year,
    month: entry.month,
    divididoCom: entry.divididoCom,
    devolvido: entry.devolvidoEm !== null,
    parteDeOutro: entry.parteDeOutro === null ? null : Number(entry.parteDeOutro),
    category: entry.category,
    parentCategory: entry.parentCategory,
    customCategoryId: entry.customCategoryId,
    subcategory: entry.subcategory,
    description: entry.description,
    amount: Number(entry.amount),
    entryDate: toDateInput(entry.entryDate),
    dayLabel: formatRelativeDay(entry.entryDate),
    goalId: entry.goalId,
    recurrenceId: entry.recurrenceId,
    pessoa: entry.pessoa,
    doCasal: entry.doCasal,
    noCartao: ehDoCartao(entry),
    cliente: entry.cliente,
    ...(entry.originalCurrency && entry.originalAmount !== null && isCurrencyCode(entry.originalCurrency)
      ? {
          // O olho do topo fechado esconde também o valor na moeda de origem.
          originalLabel: ocultos ? "••••" : formatMoney(Number(entry.originalAmount), entry.originalCurrency),
          originalAmount: Number(entry.originalAmount),
          originalCurrency: entry.originalCurrency,
          exchangeRate: entry.exchangeRate === null ? null : Number(entry.exchangeRate),
        }
      : {}),
    };
  });
}
