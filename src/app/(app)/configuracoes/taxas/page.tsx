import { getRequiredSession } from "@/lib/auth/session";
import { listReferenceRates } from "@/lib/repositories/reference-rate.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { ReferenceRateForm } from "./ReferenceRateForm";
import { DeleteRateButton } from "./DeleteRateButton";

const BASIS_LABEL: Record<string, string> = {
  ANNUAL_252: "a.a. (base 252)",
  ANNUAL_365: "a.a. (base 365)",
  MONTHLY: "a.m.",
};

type RateRow = Awaited<ReturnType<typeof listReferenceRates>>[number];

export default async function TaxasDoSistemaPage() {
  const ctx = await getRequiredSession();
  const rates = await listReferenceRates(ctx);

  const columns: ResponsiveColumn<RateRow>[] = [
    { key: "name", label: "Nome", render: (rate) => rate.name },
    { key: "rate", label: "Taxa", render: (rate) => `${(Number(rate.rateValue) * 100).toFixed(2)}%` },
    { key: "basis", label: "Base", render: (rate) => BASIS_LABEL[rate.basis] },
    { key: "date", label: "Vigente desde", render: (rate) => rate.effectiveDate.toLocaleDateString("pt-BR") },
    {
      key: "origin",
      label: "Origem",
      render: (rate) => <Badge tone={rate.userId ? "gold" : "neutral"}>{rate.userId ? "Sua taxa" : "Padrão do sistema"}</Badge>,
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
      <Breadcrumb items={[{ label: "Configurações", href: "/configuracoes/perfil" }, { label: "Taxas do Sistema" }]} />

      <PageHeader
        title="Taxas do Sistema"
        subtitle="Taxas usadas como sugestão/âncora nos módulos de planejamento e simuladores."
      />

      <ReferenceRateForm />

      <ResponsiveTable columns={columns} rows={rates} rowKey={(rate) => rate.id} emptyMessage="Nenhuma taxa cadastrada ainda." />
    </div>
  );
}
