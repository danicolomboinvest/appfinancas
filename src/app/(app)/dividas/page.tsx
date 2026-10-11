import { getRequiredSession } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { sobrouDoResumo } from "@/lib/consolidation/sobrou";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { listarDividas, selicAnual } from "@/lib/repositories/divida.repo";
import { SELIC_DE_RESERVA } from "@/lib/dividas/saude";
import { DividasTela } from "./DividasTela";

/**
 * Dívidas (versão nova, 11/10/2026): a área nova logo depois de Metas, na direção C "O bilhete"
 * do protótipo aprovado. A tela principal é o bilhete "Destino: livre" com a data em que ela sai
 * das dívidas que não são saudáveis; o Plano mexe no valor a mais por mês; o cadastro tem 8
 * passos e termina no selo Saudável, Atenção ou Cara.
 *
 * A conta é toda do motor do Rota (lib/dividas), feita no aparelho para o plano responder na hora
 * ao mexer no valor a mais. `?plano=1` abre direto o Plano (o "Ver plano" das Recorrentes).
 */
export default async function DividasPage(props: PageProps<"/dividas">) {
  const sp = await props.searchParams;
  const ctx = await getRequiredSession();
  const agora = nowInBrazil();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const [dividas, resumo, plano, selic] = await Promise.all([
    listarDividas(ctx),
    getMonthlySummary(ctx, ano, mes),
    getMonthlyPlan(ctx, ano, mes),
    selicAnual(ctx.userId),
  ]);
  // A mesma renda das Recorrentes: a do plano do mês; sem plano, a que entrou.
  const renda = plano && plano.plannedIncome > 0 ? plano.plannedIncome : resumo.totalIncome;
  const sobrou = Math.max(0, Math.floor(sobrouDoResumo(resumo)));

  return (
    <DividasTela
      dividas={dividas}
      renda={renda}
      sobrou={sobrou}
      selic={selic ?? SELIC_DE_RESERVA}
      selicDeExemplo={selic === null}
      hoje={{ ano, mes }}
      perfil={ctx.profileId}
      abrirPlano={sp.plano === "1"}
      abrirNova={sp.nova === "1"}
    />
  );
}
