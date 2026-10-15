import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { vozDoTema } from "@/lib/profiles/voice";
import { lancamentosDaEmpresa } from "@/lib/repositories/empresa.repo";
import { margemDoRecibo, reciboDosMeses } from "@/lib/empresa/regras";
import { listReferenceRates } from "@/lib/repositories/reference-rate.repo";
import { escolherTaxaDeReferencia } from "@/lib/finance/taxa-de-referencia";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { InvestirCalculadora } from "./InvestirCalculadora";

/** Taxa de comparação quando a pessoa não cadastrou nenhuma: perto do CDI de 2026. */
const TAXA_PADRAO = 0.1;

/**
 * "Vale a pena investir na empresa?": só existe no perfil Empresa. A margem de contribuição
 * vem do recibo do ano (a mesma regra do /empresa) e a taxa de comparação vem das taxas de
 * referência da pessoa, se tiver.
 */
export default async function InvestirPage() {
  const ctx = await getRequiredSession();
  if (!ehEmpresa(ctx.profileKind)) redirect("/simuladores");
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;

  const now = nowInBrazil();
  const year = now.getFullYear();
  const [lancamentos, taxas] = await Promise.all([lancamentosDaEmpresa(ctx, { ano: year, mes: 1 }), listReferenceRates(ctx)]);
  // A margem do ano pela mesma regra do recibo do /empresa (margemDoRecibo): o mesmo número que o
  // ponto de equilíbrio usa, sem o rendimento do caixa como venda nem a aplicação como custo.
  const meses = Array.from({ length: now.getMonth() + 1 }, (_, i) => ({ ano: year, mes: i + 1 }));
  const doAno = margemDoRecibo(reciboDosMeses(lancamentos, meses));
  const margem = doAno !== null && doAno > 0 ? doAno : 0.4;
  // A taxa que ela cadastrou ganha da global do sistema (ver escolherTaxaDeReferencia).
  const cdi = escolherTaxaDeReferencia(taxas, ctx.userId, /cdi|selic/i);
  const taxa = cdi ? Number(cdi.rateValue) : TAXA_PADRAO;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.invTitulo} subtitle={t.invSub} />
      <InvestirCalculadora margemInicial={margem} taxaInicial={taxa > 1 ? taxa / 100 : taxa} />
    </div>
  );
}
