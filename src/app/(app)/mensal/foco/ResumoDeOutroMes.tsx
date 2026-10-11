import type { AuthContext } from "@/lib/auth/session";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { mesesAte, montarMeses, valoresDosMeses } from "@/lib/consolidation/seis-meses";
import { GraficoSeisMeses } from "@/components/charts/GraficoSeisMeses";
import { serverMoney } from "@/lib/money-server";
import { vozDoTema } from "@/lib/profiles/voice";
import type { MesDoPeriodo } from "@/lib/visao-geral/periodo";
import { QuadroDoMes } from "./QuadroDoMes";

const NOMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** O Resumo de um mês que já passou (seletor de mês): o quadro do mês e os últimos 6 meses. */
export async function ResumoDeOutroMes({ ctx, mes, agora }: { ctx: AuthContext; mes: MesDoPeriodo; agora: Date }) {
  const [resumo, valores, money] = await Promise.all([
    getMonthlySummary(ctx, mes.ano, mes.mes),
    valoresDosMeses(ctx, mesesAte(agora.getFullYear(), agora.getMonth() + 1, 12)),
    serverMoney(),
  ]);
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const titulo = mes.ano === agora.getFullYear() ? NOMES[mes.mes - 1] : `${NOMES[mes.mes - 1]} de ${mes.ano}`;
  return (
    <div className="flex flex-col gap-5">
      <QuadroDoMes titulo={titulo} resumo={resumo} href={`/mensal/${mes.ano}/${mes.mes}`} rotulos={{ entrou: voz.titulos.entrou, gastou: voz.titulos.gastou }} money={(v) => money(v)} />
      <GraficoSeisMeses meses12={montarMeses(valores, { ano: agora.getFullYear(), mes: agora.getMonth() + 1 }, 12)} />
    </div>
  );
}
