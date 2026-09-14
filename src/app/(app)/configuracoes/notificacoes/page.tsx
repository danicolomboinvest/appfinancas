import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NotificationsForm } from "./NotificationsForm";

export default async function NotificacoesPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Configurações", href: "/configuracoes/perfil" }, { label: "Notificações" }]} />

      <PageHeader
        title="Notificações"
        subtitle="O resumo que chega por e-mail e os insights automáticos que aparecem em Análises."
      />

      <NotificationsForm
        defaults={{
          notifyBudgetAlerts: user.notifyBudgetAlerts,
          notifyLateGoals: user.notifyLateGoals,
          notifyMonthlyRecap: user.notifyMonthlyRecap,
        }}
      />
    </div>
  );
}
