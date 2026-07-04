import { requireAdmin } from "@/lib/auth/rbac";
import { listAllCriteria } from "@/lib/repositories/criterion.repo";
import { CreateCriterionForm } from "./CreateCriterionForm";
import { ToggleActiveButton } from "./ToggleActiveButton";

const SHEET_TYPE_LABEL: Record<string, string> = { STOCK: "Ações", FII: "FIIs" };

export default async function AdminCriteriosPage() {
  await requireAdmin();
  const criteria = await listAllCriteria();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Catálogo de Critérios</h1>
        <p className="mt-1 text-sm text-black/60">
          Critérios das fichas de análise de Ações e FIIs. Editável sem precisar de deploy.
        </p>
      </div>

      <CreateCriterionForm />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-black/60">
            <th className="py-2">Ficha</th>
            <th className="py-2">Categoria</th>
            <th className="py-2">Rótulo</th>
            <th className="py-2">Chave</th>
            <th className="py-2">Ordem</th>
            <th className="py-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((criterion) => (
            <tr key={criterion.id} className={`border-b border-black/5 ${!criterion.active ? "opacity-50" : ""}`}>
              <td className="py-2">{SHEET_TYPE_LABEL[criterion.sheetType]}</td>
              <td className="py-2">{criterion.category}</td>
              <td className="py-2">{criterion.label}</td>
              <td className="py-2 font-mono text-xs">{criterion.key}</td>
              <td className="py-2">{criterion.order}</td>
              <td className="py-2">{criterion.active ? "Ativo" : "Inativo"}</td>
              <td className="py-2">
                <ToggleActiveButton id={criterion.id} active={criterion.active} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
