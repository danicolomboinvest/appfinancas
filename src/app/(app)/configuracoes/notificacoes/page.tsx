import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NotificationsForm } from "./NotificationsForm";
import { PushSettings } from "./PushSettings";
import { prisma } from "@/lib/db/prisma";

export default async function NotificacoesPage() {
  const ctx = await getRequiredSession();
  const [user, devices] = await Promise.all([getOwnUser(ctx), prisma.pushSubscription.count({ where: { userId: ctx.userId } })]);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Configurações", href: "/configuracoes/perfil" }, { label: "Notificações" }]} />

      <PageHeader
        title="Notificações"
        subtitle="Avisos no celular, o resumo por e-mail e o que aparece em Análises."
      />

      <PushSettings publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} devices={devices} />

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
