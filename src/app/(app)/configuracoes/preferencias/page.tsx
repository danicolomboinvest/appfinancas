import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PreferencesForm } from "./PreferencesForm";

export default async function PreferenciasPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Ajustes da conta", href: "/configuracoes/perfil" }, { label: "Preferências" }]} />

      <PageHeader title="Preferências" subtitle="Moeda e tema de exibição." />

      <PreferencesForm defaults={{ currency: user.currency, theme: user.theme }} />
    </div>
  );
}
