import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { vozDoTema } from "@/lib/profiles/voice";
import { dadosDaEmpresa } from "@/lib/profiles/empresa-dados";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { sumExpensesByParentCategoryForYear, sumExpensesByCustomCategoryForYear } from "@/lib/repositories/budget.repo";
import { listReferenceRates } from "@/lib/repositories/reference-rate.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { InvestirCalculadora } from "./InvestirCalculadora";

/** Taxa de comparação quando a pessoa não cadastrou nenhuma: perto do CDI de 2026. */
const TAXA_PADRAO = 0.1;

/**
 * "Vale a pena investir na empresa?" — só existe no perfil Empresa. A margem de contribuição
 * vem da DRE do ano (o app já sabe quanto sobra de cada venda) e a taxa de comparação vem
 * das taxas de referência da pessoa, se tiver.
 */
export default async function InvestirPage() {
  const ctx = await getRequiredSession();
  if (!ehEmpresa(ctx.profileKind)) redirect("/simuladores");
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;

  const now = nowInBrazil();
  const year = now.getFullYear();
  const [summary, porMae, porPersonalizada, taxas] = await Promise.all([
    getYearlySummary(ctx, year),
    sumExpensesByParentCategoryForYear(ctx, year),
    sumExpensesByCustomCategoryForYear(ctx, year),
    listReferenceRates(ctx),
  ]);
  const dados = await dadosDaEmpresa(
    ctx,
    {
      receita: summary.totalIncome,
      retido: summary.totalInvestment,
      gastoPorCategoria: porMae.map((r) => ({ parentCategory: r.parentCategory, spent: r.spent })),
      gastoPersonalizado: porPersonalizada.reduce((s, r) => s + r.spent, 0),
    },
    { year, month: now.getMonth() + 1 },
  );
  const margem = dados.dre.margemContribuicaoPct !== null && dados.dre.margemContribuicaoPct > 0 ? dados.dre.margemContribuicaoPct : 0.4;
  const cdi = taxas.find((t) => /cdi|selic/i.test(t.name));
  const taxa = cdi ? Number(cdi.rateValue) : TAXA_PADRAO;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.invTitulo} subtitle={t.invSub} />
      <InvestirCalculadora margemInicial={margem} taxaInicial={taxa > 1 ? taxa / 100 : taxa} />
    </div>
  );
}
