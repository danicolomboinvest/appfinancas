import { requireAdmin } from "@/lib/auth/rbac";
import { listAllCriteria } from "@/lib/repositories/criterion.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CreateCriterionForm } from "./CreateCriterionForm";
import { ToggleActiveButton } from "./ToggleActiveButton";

const SHEET_TYPE_LABEL: Record<string, string> = { STOCK: "Ações", FII: "FIIs", STOCK_INTL: "Stocks", ETF: "ETFs" };

export default async function AdminCriteriosPage() {
  await requireAdmin();
  const criteria = await listAllCriteria();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Catálogo de Critérios" subtitle="Critérios das fichas de análise de Ações e FIIs. Editável sem precisar de deploy." />

      <CreateCriterionForm />

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-ink-muted">
              <th className="px-4 py-3 font-medium">Ficha</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Rótulo</th>
              <th className="px-4 py-3 font-medium">Chave</th>
              <th className="px-4 py-3 font-medium">Ordem</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((criterion) => (
              <tr
                key={criterion.id}
                className={`border-b border-border/60 last:border-0 hover:bg-surface-2/40 ${!criterion.active ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3 text-ink-muted">{SHEET_TYPE_LABEL[criterion.sheetType]}</td>
                <td className="px-4 py-3 text-ink-muted">{criterion.category}</td>
                <td className="px-4 py-3 text-ink">{criterion.label}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-faint">{criterion.key}</td>
                <td className="px-4 py-3 text-ink-muted">{criterion.order}</td>
                <td className="px-4 py-3">
                  <Badge tone={criterion.active ? "success" : "neutral"}>{criterion.active ? "Ativo" : "Inativo"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <ToggleActiveButton id={criterion.id} active={criterion.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
