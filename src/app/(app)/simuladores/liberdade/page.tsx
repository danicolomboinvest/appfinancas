import { getRequiredSession } from "@/lib/auth/session";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { carregarDadosDasCalculadoras } from "@/lib/calculadoras/dados-do-app";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { deParametros, EXEMPLO_LIBERDADE } from "@/lib/calculadoras/liberdade";
import { LiberdadeGuiada } from "@/components/calculadoras/fluxos/LiberdadeGuiada";

/**
 * Liberdade financeira em Calculadoras (11/10/2026), no lugar da antiga Aposentadoria de Metas.
 * Quem já tinha a conta salva abre direto no resultado; quem não tem começa no exemplo, com o
 * investido de hoje puxado da Carteira (e dito de onde veio).
 */
export default async function LiberdadePage() {
  const ctx = await getRequiredSession();
  const [params, dados] = await Promise.all([getPlanningParams(ctx), carregarDadosDasCalculadoras(ctx)]);
  const agora = nowInBrazil();
  const inicial = params
    ? deParametros({
        currentAge: params.currentAge,
        retirementAge: params.retirementAge,
        currentPatrimony: Number(params.currentPatrimony),
        monthlyContributionAccumulation: Number(params.monthlyContributionAccumulation),
        accumulationAnnualRate: Number(params.accumulationAnnualRate),
        inflationAnnualRate: Number(params.inflationAnnualRate),
        usufructAnnualRate: Number(params.usufructAnnualRate),
        desiredPassiveIncome: Number(params.desiredPassiveIncome),
        otherPassiveIncome: Number(params.otherPassiveIncome),
      })
    : { ...EXEMPLO_LIBERDADE, patrimonio: dados.carteira ? Math.round(dados.carteira) : EXEMPLO_LIBERDADE.patrimonio };
  const origem = !params && dados.carteira ? { patrimonio: "Da sua carteira" } : {};
  return <LiberdadeGuiada inicial={inicial} jaSalva={!!params} origem={origem} hoje={{ ano: agora.getFullYear(), mes: agora.getMonth() + 1 }} />;
}
