import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { defaultGoalAnnualRate } from "@/lib/repositories/reference-rate.repo";
import { getOwnGoal } from "@/lib/repositories/goal.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { parseTripPlan, type TripPlan } from "@/lib/travel/assistente";
import { AssistenteDeViagem } from "./AssistenteDeViagem";

/** "AAAA-MM-DD" no calendário do Brasil (vai como texto: um Date mudaria de dia no fuso do aparelho). */
function diaDeHoje(): string {
  const h = nowInBrazil();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

/**
 * Viagem em assistente (versão nova): uma pergunta por tela, do "Para onde?" ao cartão de
 * embarque, que vira meta. Com `?meta=<id>` (o "Editar" de uma meta criada aqui), abre direto
 * no cartão de embarque daquela viagem, com "Ajustar" para voltar a qualquer passo.
 */
export default async function ViagemPage({ searchParams }: { searchParams: Promise<{ meta?: string | string[] }> }) {
  const ctx = await getRequiredSession();
  // Coisa de pessoa física: a Empresa não vê no menu e, por link, cai na Visão geral.
  if (ehEmpresa(ctx.profileKind)) redirect("/empresa");
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const { meta } = await searchParams;
  const metaId = typeof meta === "string" ? meta : null;

  let inicial: TripPlan | null = null;
  // A mesma taxa com que a meta nasce (ou a da meta que já existe): é o que faz o "Guardando
  // R$ X por mês" do cartão bater com o aporte que a meta pede depois.
  let annualRate = await defaultGoalAnnualRate(ctx.userId);
  if (metaId) {
    const goal = await getOwnGoal(ctx, metaId);
    inicial = goal ? parseTripPlan(goal.viagem) : null;
    if (goal?.annualRate !== null && goal?.annualRate !== undefined) annualRate = Number(goal.annualRate);
  }

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">{t.viagemTitulo}</h1>
      <AssistenteDeViagem
        // Trocar de meta (ou sair dela) recomeça o assistente do zero.
        key={inicial ? metaId : "nova"}
        annualRate={annualRate}
        hoje={diaDeHoje()}
        inicial={inicial}
        metaId={inicial ? metaId : null}
      />
    </div>
  );
}
