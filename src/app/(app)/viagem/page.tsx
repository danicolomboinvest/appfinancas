import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { TravelPlanner } from "./TravelPlanner";

export default async function ViagemPage() {
  // A sessão entra só pra saber em que voz o título fala; o planejador é todo cliente.
  const ctx = await getRequiredSession();
  // Coisa de pessoa física: a Empresa não vê no menu e, por link, cai na Visão geral.
  if (ehEmpresa(ctx.profileKind)) redirect("/dashboard");
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t.viagemTitulo} subtitle={t.viagemSub} />
      <TravelPlanner />
    </div>
  );
}
