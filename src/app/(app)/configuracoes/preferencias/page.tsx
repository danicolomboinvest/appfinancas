import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PreferencesForm } from "./PreferencesForm";
import { temaDeixaEscolherModo } from "@/lib/profiles/themes";
import { vozDoTema } from "@/lib/profiles/voice";

export default async function PreferenciasPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: t.cfgBreadcrumb, href: "/configuracoes/perfil" }, { label: t.cfgAbaPreferencias }]} />

      <PageHeader title={t.cfgPreferenciasTitulo} subtitle={t.cfgPreferenciasSub} />

      <PreferencesForm defaults={{ currency: user.currency, theme: user.theme }} podeEscolherModo={temaDeixaEscolherModo(ctx.profileTheme)} />
    </div>
  );
}
