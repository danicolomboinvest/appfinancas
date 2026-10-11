import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { listMonthlyEntries, listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";
import { ehDoCartao } from "@/lib/cartao/limite";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntryList } from "./EntryList";
import { ImportHistory } from "./ImportHistory";
import { listImportBatches } from "@/lib/repositories/import-batch.repo";
import { valoresOcultos } from "@/lib/money-server";
import { formatMoney, isCurrencyCode } from "@/lib/money";
import { estadoDoMes, vozDoTema } from "@/lib/profiles/voice";
import { ThemeFooter } from "./ThemeFooter";
import { PrimeiroPassoDoMes } from "./PrimeiroPassoDoMes";
import { prisma } from "@/lib/db/prisma";
import { BotoesDeLancar } from "@/components/ui/BotoesDeLancar";


/** Cor do valor por tipo de lançamento, mesma convenção do resto do app (verde entrada,
 * vermelho saída, dourado aporte). */
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


export default async function MonthPage(props: PageProps<"/mensal/[year]/[month]">) {
  const { year: yearParam, month: monthParam } = await props.params;
  const year = Number(yearParam);
  const month = Number(monthParam);
  // URL editada à mão ("/mensal/abc/13") viraria NaN/mês 13 direto no Prisma → erro 500.
  // Fora da faixa válida é simplesmente uma página que não existe.
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    notFound();
  }

  const ctx = await getRequiredSession();
  const ocultos = await valoresOcultos();
  // Só o que a lista precisa (a tela antiga também calculava gráficos, DRE e comparações que
  // saíram daqui): menos consultas, a aba abre mais rápido.
  const [entries, summary, recentSubcategories, customCategories, goals, importBatches] = await Promise.all([
    listMonthlyEntries(ctx, year, month),
    getMonthlySummary(ctx, year, month),
    listRecentSubcategories(ctx),
    listCustomCategories(ctx),
    listGoals(ctx),
    listImportBatches(ctx),
  ]);

  // Conta nova: nenhum lançamento em NENHUM mês deste perfil. No lugar da lista vazia, um passo
  // só: importar o extrato. A consulta extra só roda quando o mês aberto está vazio.
  const contaNova =
    entries.length === 0 &&
    !(await prisma.monthlyEntry.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId }, select: { id: true } }));
  if (contaNova) {
    const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
    return (
      <PrimeiroPassoDoMes
        titulo={t.uiMesNovoTitulo}
        texto={t.uiMesNovoTexto}
        importar={t.uiMesNovoImportar}
        digitar={t.uiMesNovoDigitar}
        ajuda={t.uiMesNovoAjuda}
        confianca={t.uiMesNovoConfianca}
      />
    );
  }

  const goalOptions = goals.map((g) => ({ id: g.id, name: g.name }));
  // A voz do tema do perfil: o que a tela diz.
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const estado = estadoDoMes({ income: summary.totalIncome, expense: summary.totalExpense, investment: summary.totalInvestment });

  return (
    <div className="flex flex-col gap-6 lg:gap-5">

      {/* Transações (versão nova, como no protótipo): o mês vem do seletor da Visão geral, logo
          abaixo das abas; aqui fica só a lista. Os números e gráficos do mês saíram (o Resumo e o
          Orçamento já mostram o mês). */}

      {entries.length === 0 ? (
        <EmptyState icon={Receipt} message={voz.mesVazio} action={<BotoesDeLancar rotulo="Adicionar lançamento" />} />
      ) : (
        <EntryList
          year={year}
          month={month}
          recentSubcategories={recentSubcategories}
          customCategories={customCategories}
          goals={goalOptions}
          entries={entries.map((entry) => ({
            id: entry.id,
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
            ...(entry.originalCurrency && entry.originalAmount !== null && isCurrencyCode(entry.originalCurrency)
              ? {
                  // O olho do topo fechado esconde também o valor na moeda de origem.
                  originalLabel: ocultos ? "••••" : formatMoney(Number(entry.originalAmount), entry.originalCurrency),
                  originalAmount: Number(entry.originalAmount),
                  originalCurrency: entry.originalCurrency,
                  exchangeRate: entry.exchangeRate === null ? null : Number(entry.exchangeRate),
                }
              : {}),
          }))}
        />
      )}



      {/* Histórico do que foi importado em massa, com "Desfazer" por lote (upload errado ou
          duplicado some inteiro, sem caçar lançamento por lançamento). */}
      {/* A âncora é o destino do "Gasto do cartão" no "Isso está errado?". */}
      <div id="importacoes" className="scroll-mt-24">
      <ImportHistory
        batches={importBatches.map((b) => ({
          id: b.id,
          docType: b.docType,
          fileName: b.fileName,
          createdAt: b.createdAt.toISOString(),
          entryCount: b.entryCount,
          totalAmount: b.totalAmount,
          months: b.months,
        }))}
      />
      </div>

      <ThemeFooter texto={voz.rodape(estado)} />
    </div>
  );
}
