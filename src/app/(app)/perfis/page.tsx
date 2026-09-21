import { getRequiredSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfilesManager } from "@/components/profiles/ProfilesManager";

export const metadata = { title: "Perfis · SPI Finance" };

export default async function PerfisPage() {
  const ctx = await getRequiredSession();
  const perfis = await listProfiles(ctx.userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Seus perfis"
        subtitle="Cada perfil é um dinheiro separado: lançamentos, metas e carteira não se misturam entre eles."
      />
      <ProfilesManager perfis={perfis} ativoId={ctx.profileId} />
    </div>
  );
}
