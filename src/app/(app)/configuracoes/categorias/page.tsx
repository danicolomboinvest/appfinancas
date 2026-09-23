import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { PARENT_CATEGORIES, OUTRO_SUBCATEGORY_LABEL, categoryLabel, subcategoriesFor } from "@/lib/categories";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";

export default async function CategoriasPage() {
  // A lista é fixa por tipo de perfil; a sessão entra pra saber em que voz o título fala e se
  // as categorias são as de pessoa ou as de empresa (mesmas chaves, outros nomes).
  const ctx = await getRequiredSession();
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: t.cfgBreadcrumb, href: "/configuracoes/perfil" }, { label: t.cfgAbaCategorias }]} />

      <PageHeader title={t.cfgCategoriasTitulo} subtitle={t.cfgCategoriasSub} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PARENT_CATEGORIES.map((pc) => (
          <Card key={pc} className="p-4">
            <p className="text-sm font-medium text-ink">{categoryLabel(ctx.profileKind, pc)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {subcategoriesFor(ctx.profileKind, pc).map((s) => (
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
