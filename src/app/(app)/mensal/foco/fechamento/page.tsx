import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { sobrouDoResumo } from "@/lib/consolidation/sobrou";
import { prisma } from "@/lib/db/prisma";
import { lerFechamento } from "@/lib/repositories/fechamento.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { carregarFoco } from "../dados";
import { chaveDoMes } from "../ritmo";
import { Fechamento, MesFechado, type DadosFechamento } from "./Fechamento";
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
  const [resumo, estado, metas, aportes] = await Promise.all([
    getMonthlySummary(ctx, year, month),
    lerFechamento(ctx, year, month),
    prisma.goal.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, status: { not: "ACHIEVED" } }, select: { id: true, name: true, targetDate: true }, orderBy: [{ targetDate: "asc" }, { createdAt: "asc" }] }),
    prisma.monthlyEntry.groupBy({
      by: ["goalId"],
      where: { userId: ctx.userId, profileId: ctx.profileId, year, month, category: "INVESTMENT_CONTRIBUTION", goalId: { not: null } },
      _sum: { amount: true },
    }),
  ]);
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
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link href="/mensal/foco" className="flex min-h-11 w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> {d.t.focoTitulo}
      </Link>
      <PageHeader title={textos.titulo} />
      {estado.estado === "fechado" ? (
        <MesFechado d={dados} />
      ) : (
        <>
          {estado.estado === "reaberto" && <p className="-mt-3 text-sm text-ink-muted">{textos.detalhe}</p>}
          <Fechamento d={dados} />
        </>
      )}
    </div>
  );
}
