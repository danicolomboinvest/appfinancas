import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { defaultGoalAnnualRate } from "@/lib/repositories/reference-rate.repo";
import { TravelPlanner } from "./TravelPlanner";

export default async function ViagemPage() {
  // A sessão entra pra saber em que voz o título fala e qual taxa a meta vai usar; o resto do
  // planejador é todo cliente.
  const ctx = await getRequiredSession();
  // Coisa de pessoa física: a Empresa não vê no menu e, por link, cai na Visão geral.
  if (ehEmpresa(ctx.profileKind)) redirect("/dashboard");
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);
  // A mesma taxa com que a meta vai nascer: é o que faz o "guardando R$ X/mês" do planejador
  // bater com o aporte que a meta pede depois.
  const annualRate = await defaultGoalAnnualRate(ctx.userId);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t.viagemTitulo} subtitle={t.viagemSub} />
      <TravelPlanner annualRate={annualRate} />
    </div>
  );
}
