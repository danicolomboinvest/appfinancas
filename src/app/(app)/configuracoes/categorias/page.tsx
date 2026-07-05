import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { PARENT_CATEGORIES, PARENT_CATEGORY_LABEL, SUBCATEGORIES, OUTRO_SUBCATEGORY_LABEL } from "@/lib/categories";

export default function CategoriasPage() {
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Configurações", href: "/configuracoes/perfil" }, { label: "Categorias" }]} />

      <PageHeader
        title="Categorias"
        subtitle="Categorias-mãe e subcategorias pré-cadastradas, usadas na categorização de gastos no Fluxo Financeiro. Em qualquer lançamento, o chip 'Outro' permite descrever uma subcategoria livre."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PARENT_CATEGORIES.map((pc) => (
          <Card key={pc} className="p-4">
            <p className="text-sm font-medium text-ink">{PARENT_CATEGORY_LABEL[pc]}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUBCATEGORIES[pc].map((s) => (
                <span key={s} className="rounded-full border border-border-strong bg-surface-2 px-2.5 py-1 text-xs text-ink-muted">
                  {s}
                </span>
              ))}
              <span className="rounded-full border border-border-strong bg-surface-2 px-2.5 py-1 text-xs text-ink-faint">
                {OUTRO_SUBCATEGORY_LABEL}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
