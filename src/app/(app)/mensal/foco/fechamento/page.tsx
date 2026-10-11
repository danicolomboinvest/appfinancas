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
import { ReabrirMes } from "./ReabrirMes";
import { textosDoFechamento } from "./estado";
import { lerSobrou, sobrouDoResumo } from "@/lib/consolidation/sobrou";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { Card } from "@/components/ui/Card";
import { serverMoney } from "@/lib/money-server";

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
        ? { key: b.parentCategory as string, label: categoryLabel(ctx.categorias ?? ctx.profileKind, b.parentCategory as ParentCategory), planejado: Number(b.plannedAmount), gasto: gastoMae.get(b.parentCategory) ?? 0, mae: true }
        : { key: b.customCategoryId ?? b.id, label: nome.get(b.customCategoryId ?? "") ?? "Personalizada", planejado: Number(b.plannedAmount), gasto: gastoPers.get(b.customCategoryId ?? "") ?? 0, mae: false },
    );
  const livre = d.foco.livre;
  const textos = textosDoFechamento(d.fechamento.estado, month, d.fechamento.em);
  const sobrou = lerSobrou(sobrouDoResumo(resumo));
  const money = await serverMoney();
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
    faltaNaReserva: d.fund ? Math.max(0, Number(d.fund.targetAmount) - Number(d.fund.currentAmount)) : 0,
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/mensal/foco" className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> {d.t.focoTitulo}
      </Link>
      <PageHeader title={textos.titulo} />
      {d.fechamento.estado === "fechado" ? (
        // O resumão do mês fechado: os quatro números da conta e a data em que fechou.
        <Card className="flex flex-col gap-4 p-5">
          {textos.detalhe && <p className="text-sm text-ink-muted">{textos.detalhe}</p>}
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["Entrou", resumo.totalIncome],
              ["Gastou", resumo.totalExpense],
              ["Guardou", resumo.totalInvestment],
            ].map(([rotulo, valor]) => (
              <div key={rotulo as string} className="rounded-2xl bg-surface-2 p-3">
                <dt className="text-caption text-ink-muted">{rotulo}</dt>
                <dd className="mt-1 text-ink">
                  <ValorDestaque texto={money(valor as number, { round: true })} className="text-[1.5rem] font-light tabular-nums" />
                </dd>
              </div>
            ))}
            <div className="rounded-2xl bg-success-soft p-3">
              <dt className="text-caption text-ink-muted">{sobrou.rotulo}</dt>
              <dd className="mt-1 text-ink">
                <ValorDestaque texto={money(sobrou.valor, { round: true })} className="text-[1.5rem] font-light tabular-nums" />
              </dd>
            </div>
          </dl>
          <ReabrirMes chave={dados.chave} rotulo={textos.botao} mes={label} />
        </Card>
      ) : (
        <>
          {d.fechamento.estado === "reaberto" && <p className="text-sm text-ink-muted">{textos.detalhe}</p>}
          <Fechamento d={dados} />
        </>
      )}
    </div>
  );
}
