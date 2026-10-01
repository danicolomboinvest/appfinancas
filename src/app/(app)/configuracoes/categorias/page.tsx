import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { categoryLabel } from "@/lib/categories";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { listTransactionRulesForSettings } from "@/lib/repositories/transaction-rule.repo";
import { RegrasAprendidas } from "./RegrasAprendidas";
import { EditorDeCategorias } from "./EditorDeCategorias";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";

export default async function CategoriasPage() {
  // A lista é fixa por tipo de perfil; a sessão entra pra saber em que voz o título fala e se
  // as categorias são as de pessoa ou as de empresa (mesmas chaves, outros nomes).
  const ctx = await getRequiredSession();
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const [regras, proprias] = await Promise.all([listTransactionRulesForSettings(ctx), listCustomCategories(ctx)]);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: t.cfgBreadcrumb, href: "/configuracoes/perfil" }, { label: t.cfgAbaCategorias }]} />

      <PageHeader title={t.cfgCategoriasTitulo} subtitle={t.cfgCategoriasSub} />

      <EditorDeCategorias proprias={proprias.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))} />

      <Card className="p-4">
        <p className="text-sm font-medium text-ink">O que o app já aprendeu</p>
        <p className="mb-3 mt-0.5 text-caption text-ink-faint">
          Nomes de loja que ele já sabe em que categoria pôr. Apague o que ficou errado.
        </p>
        <RegrasAprendidas
          regras={regras.map((r) => ({
            id: r.id,
            pattern: r.pattern,
            categoria: categoryLabel(ctx.categorias ?? ctx.profileKind, r.parentCategory),
            subcategory: r.subcategory,
          }))}
        />
      </Card>
    </div>
  );
}
