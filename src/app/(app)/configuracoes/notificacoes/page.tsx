import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { NotificationsForm } from "./NotificationsForm";
import { PushSettings } from "./PushSettings";
import { prisma } from "@/lib/db/prisma";
import { vozDoTema } from "@/lib/profiles/voice";

/**
 * Notificações (protótipo, #configuracoes-notificacoes): "No celular" com a chave do aparelho, as
 * contas a vencer (que se ligam em cada conta, em Recorrentes) e o horário; "Por e-mail e no app"
 * com as três chaves de sempre. Fechar o mês, Aporte da meta e Resumo da semana ainda não têm
 * aviso no servidor: aparecem como "em breve", sem chave que finja funcionar.
 */
export default async function NotificacoesPage() {
  const ctx = await getRequiredSession();
  const [user, devices] = await Promise.all([getOwnUser(ctx), prisma.pushSubscription.count({ where: { userId: ctx.userId } })]);
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const grupo = "overflow-hidden rounded-3xl bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]";
  const linha = "flex min-h-14 items-center gap-3 border-t border-border px-4 py-2.5";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <h1 className="titulo-tema text-2xl font-medium text-ink">{t.cfgNotificacoesTitulo}</h1>

      <h2 className="px-1 pt-2 text-[15px] font-medium text-ink">No celular</h2>
      <div className={grupo}>
        <PushSettings publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} devices={devices} />
        <Link href="/orcamento/contas" className={linha}>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-normal text-ink">Contas a vencer</b>
            <small className="text-[13px] text-ink-muted">Um dia antes e no dia. Ligue em cada conta, em Recorrentes.</small>
          </span>
          <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />
        </Link>
        {[
          ["Fechar o mês", "No último dia do mês."],
          ["Aporte da meta", "No dia do salário."],
          ["Resumo da semana", "Toda segunda."],
        ].map(([titulo, sub]) => (
          <div key={titulo} className={linha}>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-normal text-ink-muted">{titulo}</b>
              <small className="text-[13px] text-ink-faint">{sub}</small>
            </span>
            <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-muted">em breve</span>
          </div>
        ))}
        <div className={linha}>
          <b className="min-w-0 flex-1 text-[15px] font-normal text-ink">Horário dos avisos</b>
          <span className="shrink-0 text-sm tabular-nums text-ink-muted">8h, horário de Brasília</span>
        </div>
      </div>

      <h2 className="px-1 pt-2 text-[15px] font-medium text-ink">Por e-mail e no app</h2>
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
