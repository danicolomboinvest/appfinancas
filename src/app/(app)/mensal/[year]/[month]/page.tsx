import { notFound } from "next/navigation";
import { classificadorDaCasa, divisaoDaCasaNoMes } from "@/lib/repositories/casa.repo";
import { getRequiredSession } from "@/lib/auth/session";
import { perfisDeDestino } from "@/lib/repositories/mover-perfil.repo";
import { dadosDaDivisao, listMonthlyEntries, listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { VazioDeTransacoes } from "@/components/ui/VazioDeTransacoes";
import { EntryList } from "./EntryList";
import { linhasDaLista } from "./linhas";
import { CartaoAReceber } from "./CartaoAReceber";
import { ImportHistory } from "./ImportHistory";
import { listImportBatches } from "@/lib/repositories/import-batch.repo";
import { valoresOcultos } from "@/lib/money-server";
import { estadoDoMes, vozDoTema } from "@/lib/profiles/voice";
import { ThemeFooter } from "./ThemeFooter";
import { PrimeiroPassoDoMes } from "./PrimeiroPassoDoMes";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { ehFuturo, mesDeAgora } from "@/lib/visao-geral/periodo";
import { carregarMesesPrevistos } from "@/lib/repositories/previsao.repo";
import { serverMoney } from "@/lib/money-server";
import { MesPrevistoNaTela } from "@/components/previsao/MesesPrevistos";


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
  // Mês que ainda não chegou (voltou em 14/10/2026): em cima, o previsto (parcelas, contas,
  // assinaturas); embaixo, o que já foi lançado para ele (conta que repete, parcela projetada).
  const agora = nowInBrazil();
  const futuro = ehFuturo({ ano: year, mes: month }, agora);
  const previsto = futuro ? (await carregarMesesPrevistos(ctx, mesDeAgora(agora), { ano: year, mes: month }, 1))[0] : null;
  const moneyP = previsto ? await serverMoney() : null;
  const ocultos = await valoresOcultos();
  // Só o que a lista precisa (a tela antiga também calculava gráficos, DRE e comparações que
  // saíram daqui): menos consultas, a aba abre mais rápido.
  const [entries, summary, recentSubcategories, customCategories, goals, importBatches, divisao, perfisDestino] = await Promise.all([
    listMonthlyEntries(ctx, year, month),
    getMonthlySummary(ctx, year, month),
    listRecentSubcategories(ctx),
    listCustomCategories(ctx),
    listGoals(ctx),
    listImportBatches(ctx),
    dadosDaDivisao(ctx),
    perfisDeDestino(ctx),
  ]);

  // Conta nova: nenhum lançamento em NENHUM mês deste perfil. No lugar da lista vazia, um passo
  // só: importar o extrato. A consulta extra só roda quando o mês aberto está vazio.
  const contaNova =
    entries.length === 0 &&
    !(await prisma.monthlyEntry.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId }, select: { id: true } }));
  if (contaNova && !previsto) {
    const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
    return (
      <PrimeiroPassoDoMes titulo={t.uiMesNovoTitulo} texto={t.uiMesNovoTexto} importar="Extrato ou fatura" />
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

      {previsto && moneyP && <MesPrevistoNaTela m={previsto} money={(v) => moneyP(v, { round: true })} />}
      <CartaoAReceber aReceber={divisao.aReceber} />
      {/* Os arquivos enviados, com "Desfazer" por envio (upload errado ou duplicado some inteiro, sem
          caçar lançamento por lançamento). No topo: no fim da lista ninguém achava (21/10/2026).
          A âncora é o destino do "Gasto do cartão" no "Isso está errado?". */}
      <div id="importacoes" className="scroll-mt-24">
        <ImportHistory
          batches={importBatches.map((b) => ({
            id: b.id,
            docType: b.docType,
            fileName: b.fileName,
            createdAt: b.createdAt.toISOString(),
            entryCount: b.entryCount,
            parcelasFuturas: b.parcelasFuturas,
            totalAmount: b.totalAmount,
            months: b.months,
          }))}
        />
      </div>
      {entries.length === 0 && previsto ? null : entries.length === 0 ? (
        <VazioDeTransacoes />
      ) : (
        <EntryList
          year={year}
          month={month}
          recentSubcategories={recentSubcategories}
          customCategories={customCategories}
          goals={goalOptions}
          pessoasDaDivisao={divisao.pessoas}
          perfisDestino={perfisDestino}
          entries={linhasDaLista(entries, ocultos, ctx, ctx.casa ? await classificadorDaCasa(ctx) : null)}
          divisaoDaCasa={ctx.casa ? await divisaoDaCasaNoMes(ctx, year, month) : null}
        />
      )}




      <ThemeFooter texto={voz.rodape(estado)} />
    </div>
  );
}
