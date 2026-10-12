import type { AuthContext } from "@/lib/auth/session";
import { listEntriesInInterval } from "@/lib/repositories/monthly-entry.repo";
import { mesesAte, montarMeses, valoresDosMeses } from "@/lib/consolidation/seis-meses";
import { GraficoSeisMeses } from "@/components/charts/GraficoSeisMeses";
import { serverMoney } from "@/lib/money-server";
import { vozDoTema } from "@/lib/profiles/voice";
import { type Intervalo, hrefDoIntervalo, rotuloDoIntervalo, soMesesInteiros } from "@/lib/visao-geral/periodo";
import { somaDoIntervalo } from "@/lib/visao-geral/intervalo-dados";
import { QuadroDoMes } from "./QuadroDoMes";

/**
 * O Resumo de um período que não é um mês ("Ver o período"): o quadro do período, com o título
 * do protótipo ("Últimos 7 dias · 5 a 11 out"), e os últimos meses. Quando o período não fecha
 * meses inteiros, o último quadro é "Saldo do período" (protótipo, aplicaPer).
 */
export async function ResumoDoPeriodo({ ctx, intervalo, agora }: { ctx: AuthContext; intervalo: Intervalo; agora: Date }) {
  const [entries, valores, money] = await Promise.all([
    listEntriesInInterval(ctx, intervalo),
    valoresDosMeses(ctx, mesesAte(agora.getFullYear(), agora.getMonth() + 1, 12)),
    serverMoney(),
  ]);
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const r = rotuloDoIntervalo(intervalo);
  return (
    <div className="flex flex-col gap-5">
      <QuadroDoMes
        titulo={`${r.nome} · ${r.sub}`}
        resumo={somaDoIntervalo(entries)}
        href={hrefDoIntervalo("transacoes", intervalo)}
        rotulos={{ entrou: voz.titulos.entrou, gastou: voz.titulos.gastou }}
        money={(v) => money(v)}
        parcial={!soMesesInteiros(intervalo)}
      />
      <GraficoSeisMeses meses12={montarMeses(valores, { ano: agora.getFullYear(), mes: agora.getMonth() + 1 }, 12)} />
    </div>
  );
}
