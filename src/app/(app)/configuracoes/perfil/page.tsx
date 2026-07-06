import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ProfileForm } from "./ProfileForm";

export default async function PerfilPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Ajustes da conta", href: "/configuracoes/perfil" }, { label: "Perfil" }]} />

      <PageHeader title="Perfil" subtitle="Suas informações pessoais." />

      <ProfileForm defaults={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }} />
    </div>
  );
}
