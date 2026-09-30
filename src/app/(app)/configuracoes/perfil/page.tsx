import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ProfileForm } from "./ProfileForm";
import { formatPhone } from "@/lib/phone";
import { vozDoTema } from "@/lib/profiles/voice";

export default async function PerfilPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: t.cfgBreadcrumb, href: "/configuracoes/perfil" }, { label: t.cfgAbaPerfil }]} />

      <PageHeader title={t.cfgPerfilTitulo} subtitle={t.cfgPerfilSub} />

      <ProfileForm defaults={{ name: user.name, email: user.email, phone: formatPhone(user.phone) }} />

      {/* Dentro do app não havia caminho pra trocar a senha (conta VIP nasce com senha
          provisória) nem pra ler Termos, Privacidade e Suporte depois de logada. */}
      <Card className="flex flex-col gap-3 p-5">
        <div>
          <p className="text-sm font-medium text-ink">Senha</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            A gente manda um link pro seu e-mail pra você criar uma senha nova.
          </p>
        </div>
        <Link href="/esqueci-senha" className="w-fit text-sm font-medium text-accent-strong hover:underline">
          Trocar senha
        </Link>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
          <Link href="/termos" className="text-ink-muted hover:underline">
            Termos de Uso
          </Link>
          <Link href="/privacidade" className="text-ink-muted hover:underline">
            Política de Privacidade
          </Link>
          <Link href="/suporte" className="text-ink-muted hover:underline">
            Suporte
          </Link>
        </div>
      </Card>
    </div>
  );
}
