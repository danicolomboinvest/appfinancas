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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">

      <h1 className="titulo-tema text-2xl font-medium text-ink">{t.cfgCategoriasTitulo}</h1>

      <EditorDeCategorias proprias={proprias.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))} />

      <Card className="p-4">
        <p className="text-[15px] font-medium text-ink">Regras aprendidas</p>
        <p className="mb-3 mt-0.5 text-caption text-ink-muted">O que o app aprendeu com as suas correções.</p>
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
