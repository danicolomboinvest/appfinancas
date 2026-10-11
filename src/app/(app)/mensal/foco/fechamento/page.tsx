import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { sobrouDoResumo } from "@/lib/consolidation/sobrou";
import { prisma } from "@/lib/db/prisma";
import { lerFechamento } from "@/lib/repositories/fechamento.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ParentCategory } from "@prisma/client";
import { categoryLabel } from "@/lib/categories";
import { listBudgets, sumExpensesByParentCategory } from "@/lib/repositories/budget.repo";
import { contarGastosReaisDoMes } from "@/lib/repositories/monthly-entry.repo";

const MESES_NOME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
import { carregarFoco } from "../dados";
import { chaveDoMes } from "../ritmo";
import { Fechamento, type DadosFechamento } from "./Fechamento";
import { dataPorExtenso, textosDoFechamento } from "./estado";

/**
 * Fechar o mês ANTERIOR (seção 3.12): é o que dá para olhar com os números completos. O estado
 * vem da tabela FechamentoDoMes: não fechado e reaberto mostram os passos; fechado mostra o
 * resumo com a data e o "Reabrir".
 */
export default async function FechamentoPage() {
  const ctx = await getRequiredSession();
  const d = await carregarFoco(ctx);
  const { year, month, label } = d.mesAnterior;
  const [resumo, estado, metas, aportes, budgets, porMae, lancamentos] = await Promise.all([
    getMonthlySummary(ctx, year, month),
    lerFechamento(ctx, year, month),
    prisma.goal.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, status: { not: "ACHIEVED" } }, select: { id: true, name: true, targetDate: true }, orderBy: [{ targetDate: "asc" }, { createdAt: "asc" }] }),
    prisma.monthlyEntry.groupBy({
      by: ["goalId"],
      where: { userId: ctx.userId, profileId: ctx.profileId, year, month, category: "INVESTMENT_CONTRIBUTION", goalId: { not: null } },
      _sum: { amount: true },
    }),
    listBudgets(ctx, year, month),
    sumExpensesByParentCategory(ctx, year, month),
    contarGastosReaisDoMes(ctx, year, month),
  ]);
  // "Subir o orçamento da categoria que passou": a que mais passou entre as categorias-mãe, e só
  // quando subir de verdade (o plano deste mês ainda é menor que o gasto arredondado para cima).
  const gastoMae = new Map(porMae.map((x) => [x.parentCategory as string, x.spent]));
  const planejadoAgora = new Map(d.categorias.map((c) => [c.key, c.planejado]));
  const passou = budgets
    .filter((b) => b.parentCategory && Number(b.plannedAmount) > 0)
    .map((b) => ({ key: b.parentCategory as string, label: categoryLabel(ctx.categorias ?? ctx.profileKind, b.parentCategory as ParentCategory), planejado: Number(b.plannedAmount), gasto: gastoMae.get(b.parentCategory as string) ?? 0 }))
    .filter((c) => c.gasto - c.planejado >= 1)
    .sort((a, b) => b.gasto - b.planejado - (a.gasto - a.planejado))
    .find((c) => Math.ceil(c.gasto / 10) * 10 > (planejadoAgora.get(c.key) ?? 0));
  // "Mandar a sobra para a reserva": só com os gastos do mês no app e a reserva ainda aberta; o
  // botão diz o que vai de verdade (no máximo o que falta para ela completar).
  const sobra = sobrouDoResumo(resumo);
  const faltaNaReserva = d.fund ? Math.max(0, Number(d.fund.targetAmount) - Number(d.fund.currentAmount)) : 0;
  const praReserva = lancamentos > 0 && sobra >= 1 && faltaNaReserva >= 1 ? Math.min(sobra, faltaNaReserva) : 0;
  const porMeta = new Map(aportes.map((a) => [a.goalId, Number(a._sum.amount ?? 0)]));
  const textos = textosDoFechamento(estado.estado, month, estado.em);

  const dados: DadosFechamento = {
    chave: chaveDoMes(year, month),
    mes: label,
    estado: estado.estado,
    fechadoEm: estado.estado === "fechado" && estado.em ? dataPorExtenso(estado.em) : null,
    entrou: resumo.totalIncome,
    gastou: resumo.totalExpense,
    guardou: resumo.totalInvestment,
    sobrou: sobrouDoResumo(resumo),
    metas: metas.map((m) => ({ id: m.id, nome: m.name, guardado: porMeta.get(m.id) ?? 0 })),
    hrefTransacoes: `/mensal/${year}/${month}`,
    ano: year,
    mesNumero: month,
    mesAtual: MESES_NOME[(month % 12)],
    passou: passou ? { key: passou.key, label: passou.label, planejado: passou.planejado, gasto: passou.gasto, novo: Math.ceil(passou.gasto / 10) * 10 } : null,
    praReserva,
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link href="/mensal/foco" className="flex min-h-11 w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> {d.t.focoTitulo}
      </Link>
      <PageHeader title={textos.titulo} />
      <Fechamento d={dados} detalheReaberto={estado.estado === "reaberto" ? textos.detalhe : undefined} />
    </div>
  );
}
