import { getRequiredSession } from "@/lib/auth/session";
import { listReferenceRates } from "@/lib/repositories/reference-rate.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReferenceRateForm } from "./ReferenceRateForm";
import { DeleteRateButton } from "./DeleteRateButton";

const BASIS_LABEL: Record<string, string> = {
  ANNUAL_252: "a.a. (base 252)",
  ANNUAL_365: "a.a. (base 365)",
  MONTHLY: "a.m.",
};

export default async function ParametrosPage() {
  const ctx = await getRequiredSession();
  const rates = await listReferenceRates(ctx);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Perfil" subtitle="Taxas usadas como sugestão/âncora nos módulos de planejamento e simuladores." />

      <ReferenceRateForm />

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-ink-muted">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Taxa</th>
              <th className="px-4 py-3 font-medium">Base</th>
              <th className="px-4 py-3 font-medium">Vigente desde</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => (
              <tr key={rate.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                <td className="px-4 py-3 text-ink">{rate.name}</td>
                <td className="px-4 py-3 text-ink">{(Number(rate.rateValue) * 100).toFixed(2)}%</td>
                <td className="px-4 py-3 text-ink-muted">{BASIS_LABEL[rate.basis]}</td>
                <td className="px-4 py-3 text-ink-muted">{rate.effectiveDate.toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <Badge tone={rate.userId ? "gold" : "neutral"}>{rate.userId ? "Sua taxa" : "Padrão do sistema"}</Badge>
                </td>
                <td className="px-4 py-3">{rate.userId === ctx.userId && <DeleteRateButton id={rate.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rates.length === 0 && <EmptyState message="Nenhuma taxa cadastrada ainda." />}
      </Card>
    </div>
  );
}
