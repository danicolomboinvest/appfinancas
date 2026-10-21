import { redirect } from "next/navigation";
import { classificadorDaCasa, divisaoDaCasaNoMes } from "@/lib/repositories/casa.repo";
import { getRequiredSession } from "@/lib/auth/session";
import { perfisDeDestino } from "@/lib/repositories/mover-perfil.repo";
import { dadosDaDivisao, listEntriesInInterval, listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { valoresOcultos } from "@/lib/money-server";
import { lerIntervalo } from "@/lib/visao-geral/periodo";
import { VazioDeTransacoes } from "@/components/ui/VazioDeTransacoes";
import { EntryList } from "../[year]/[month]/EntryList";
import { linhasDaLista } from "../[year]/[month]/linhas";
import { CartaoAReceber } from "../[year]/[month]/CartaoAReceber";
import { ImportHistory } from "../[year]/[month]/ImportHistory";
import { listImportBatches } from "@/lib/repositories/import-batch.repo";

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * Transações de um período que não é um mês ("Ver o período": Últimos 7 dias, trimestre, ano ou
 * personalizado). A mesma lista do mês, só com o que cai dentro do período.
 */
export default async function TransacoesDoPeriodo(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const busca = await props.searchParams;
  const agora = nowInBrazil();
  const intervalo = lerIntervalo({ periodo: um(busca.periodo), de: um(busca.de), ate: um(busca.ate) }, agora);
  if (!intervalo) redirect(`/mensal/${agora.getFullYear()}/${agora.getMonth() + 1}`);

  const ctx = await getRequiredSession();
  const [ocultos, entries, recentSubcategories, customCategories, goals, divisao, perfisDestino, importBatches] = await Promise.all([
    valoresOcultos(),
    listEntriesInInterval(ctx, intervalo),
    listRecentSubcategories(ctx),
    listCustomCategories(ctx),
    listGoals(ctx),
    dadosDaDivisao(ctx),
    perfisDeDestino(ctx),
    listImportBatches(ctx),
  ]);

  return (
    <div className="flex flex-col gap-6 lg:gap-5">
      <CartaoAReceber aReceber={divisao.aReceber} />
      {/* Os arquivos enviados também aqui: no período não havia como desfazer um envio errado. */}
      <ImportHistory
        batches={importBatches.map((b) => ({
          id: b.id,
          docType: b.docType,
          fileName: b.fileName,
          createdAt: b.createdAt.toISOString(),
          entryCount: b.entryCount,
          parcelasFuturas: b.parcelasFuturas,
          totalAmount: b.totalAmount,
          months: b.months,
        }))}
      />
      {entries.length === 0 ? (
        <VazioDeTransacoes />
      ) : (
        <EntryList
          year={intervalo.ate.ano}
          month={intervalo.ate.mes}
          recentSubcategories={recentSubcategories}
          customCategories={customCategories}
          goals={goals.map((g) => ({ id: g.id, name: g.name }))}
          pessoasDaDivisao={divisao.pessoas}
          perfisDestino={perfisDestino}
          entries={linhasDaLista(entries, ocultos, ctx, ctx.casa ? await classificadorDaCasa(ctx) : null)}
          divisaoDaCasa={ctx.casa ? await divisaoDaCasaNoMes(ctx, intervalo.ate.ano, intervalo.ate.mes) : null}
        />
      )}
    </div>
  );
}
