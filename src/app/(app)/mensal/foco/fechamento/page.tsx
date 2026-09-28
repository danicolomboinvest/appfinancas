import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/categories";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { listBudgets, sumExpensesByParentCategory, sumExpensesByCustomCategory } from "@/lib/repositories/budget.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { contarGastosReaisDoMes } from "@/lib/repositories/monthly-entry.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { carregarFoco } from "../dados";
import { chaveDoMes } from "../ritmo";
import { Fechamento, type DadosFechamento } from "./Fechamento";

/**
 * O fechamento do mês: a "hora do Raio-X" da aula (realizado × planejado), em 6 passos e uma
 * decisão de cada vez. Fecha o mês ANTERIOR — é o que dá pra olhar com os números completos.
 */
export default async function FechamentoPage() {
  const ctx = await getRequiredSession();
  const d = await carregarFoco(ctx);
  const { year, month, label } = d.mesAnterior;
  const [budgets, porMae, porPersonalizada, personalizadas, resumo, lancamentos] = await Promise.all([
    listBudgets(ctx, year, month),
    sumExpensesByParentCategory(ctx, year, month),
    sumExpensesByCustomCategory(ctx, year, month),
    listCustomCategories(ctx),
    getMonthlySummary(ctx, year, month),
    contarGastosReaisDoMes(ctx, year, month),
  ]);
  const nome = new Map(personalizadas.map((c) => [c.id, c.name]));
  const gastoMae = new Map(porMae.map((s) => [s.parentCategory as string, s.spent]));
  const gastoPers = new Map(porPersonalizada.map((s) => [s.customCategoryId, s.spent]));
  const categorias = budgets
    .filter((b) => Number(b.plannedAmount) > 0)
    .map((b) =>
      b.parentCategory
        ? { key: b.parentCategory as string, label: categoryLabel(ctx.profileKind, b.parentCategory as ParentCategory), planejado: Number(b.plannedAmount), gasto: gastoMae.get(b.parentCategory) ?? 0, mae: true }
        : { key: b.customCategoryId ?? b.id, label: nome.get(b.customCategoryId ?? "") ?? "Personalizada", planejado: Number(b.plannedAmount), gasto: gastoPers.get(b.customCategoryId ?? "") ?? 0, mae: false },
    );
  const livre = d.foco.livre;
  const planejadoAgora = new Map(d.categorias.map((c) => [c.key, c.planejado]));

  const dados: DadosFechamento = {
    chave: chaveDoMes(year, month),
    mes: label,
    lancamentos,
    renda: resumo.totalIncome,
    gastos: resumo.totalExpense,
    guardado: resumo.totalInvestment,
    planejado: categorias.reduce((s, c) => s + c.planejado, 0),
    sobra: resumo.balance,
    passaram: categorias
      .filter((c) => c.gasto - c.planejado >= 1)
      .sort((a, b) => b.gasto - b.planejado - (a.gasto - a.planejado))
      .map((c) => ({ ...c, planejadoAgora: planejadoAgora.get(c.key) ?? 0 })),
    ano: year,
    mesNumero: month,
    aporteFaltando: d.aportePlanejado && d.aportePlanejado - d.summary.totalInvestment >= 1 ? d.aportePlanejado - d.summary.totalInvestment : 0,
    livreMes: livre.tipo === "semOrcamento" ? null : livre.restante,
    livreSemana: livre.tipo === "semOrcamento" ? null : livre.porSemana,
    reserva: !d.fund ? "sem" : Number(d.fund.currentAmount) >= Number(d.fund.targetAmount) ? "completa" : "aberta",
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/mensal/foco" className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> {d.t.focoTitulo}
      </Link>
      <PageHeader title={d.t.fechTitulo(label)} />
      {d.fechamentoFeito ? <p className="text-sm text-ink-muted">{d.t.focoFechFeito(label.charAt(0).toUpperCase() + label.slice(1))}</p> : <Fechamento d={dados} />}
    </div>
  );
}
