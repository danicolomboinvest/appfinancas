import { getRequiredSession } from "@/lib/auth/session";
import { listReferenceRates } from "@/lib/repositories/reference-rate.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { ReferenceRateForm } from "./ReferenceRateForm";
import { DeleteRateButton } from "./DeleteRateButton";
import { formatPercentNumber } from "@/lib/format";
import { vozDoTema } from "@/lib/profiles/voice";

const BASIS_LABEL: Record<string, string> = {
  ANNUAL_252: "a.a. (base 252)",
  ANNUAL_365: "a.a. (base 365)",
  MONTHLY: "a.m.",
};

type RateRow = Awaited<ReturnType<typeof listReferenceRates>>[number];

export default async function TaxasDoSistemaPage() {
  const ctx = await getRequiredSession();
  const rates = await listReferenceRates(ctx);
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);

  const columns: ResponsiveColumn<RateRow>[] = [
    { key: "name", label: t.cfgTaxaNome, render: (rate) => rate.name },
    { key: "rate", label: t.cfgTaxaTaxa, render: (rate) => formatPercentNumber(Number(rate.rateValue) * 100, 2) },
    { key: "basis", label: t.cfgTaxaBase, render: (rate) => BASIS_LABEL[rate.basis] },
    { key: "date", label: t.cfgTaxaVigenteDesde, render: (rate) => rate.effectiveDate.toLocaleDateString("pt-BR") },
    {
      key: "origin",
      label: t.cfgTaxaOrigem,
      render: (rate) => <Badge tone={rate.userId ? "accent" : "neutral"}>{rate.userId ? t.cfgTaxaSua : t.cfgTaxaPadraoSistema}</Badge>,
    },
    {
      key: "actions",
      label: "",
      hideLabelOnMobile: true,
      render: (rate) => (rate.userId === ctx.userId ? <DeleteRateButton id={rate.id} /> : null),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumb items={[{ label: t.cfgBreadcrumb, href: "/configuracoes/perfil" }, { label: t.cfgTaxasTitulo }]} />

      <PageHeader title={t.cfgTaxasTitulo} subtitle={t.cfgTaxasSub} />

      <ReferenceRateForm />

      <ResponsiveTable columns={columns} rows={rates} rowKey={(rate) => rate.id} emptyMessage={t.cfgTaxasVazio} />
    </div>
  );
}
