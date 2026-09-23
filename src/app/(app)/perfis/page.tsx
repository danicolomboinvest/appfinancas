import { getRequiredSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfilesManager } from "@/components/profiles/ProfilesManager";
import { vozDoTema } from "@/lib/profiles/voice";

export const metadata = { title: "Perfis · SPI Finance" };

export default async function PerfisPage() {
  const ctx = await getRequiredSession();
  const perfis = await listProfiles(ctx.userId);
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.cfgPerfisTitulo} subtitle={t.cfgPerfisSub} />
      <ProfilesManager perfis={perfis} ativoId={ctx.profileId} />
    </div>
  );
}
