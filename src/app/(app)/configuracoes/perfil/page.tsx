import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
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

      <ProfileForm defaults={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl, phone: formatPhone(user.phone) }} />
    </div>
  );
}
