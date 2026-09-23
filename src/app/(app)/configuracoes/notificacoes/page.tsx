import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NotificationsForm } from "./NotificationsForm";
import { PushSettings } from "./PushSettings";
import { prisma } from "@/lib/db/prisma";
import { vozDoTema } from "@/lib/profiles/voice";

export default async function NotificacoesPage() {
  const ctx = await getRequiredSession();
  const [user, devices] = await Promise.all([getOwnUser(ctx), prisma.pushSubscription.count({ where: { userId: ctx.userId } })]);
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: t.cfgBreadcrumb, href: "/configuracoes/perfil" }, { label: t.cfgAbaNotificacoes }]} />

      <PageHeader title={t.cfgNotificacoesTitulo} subtitle={t.cfgNotificacoesSub} />

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
