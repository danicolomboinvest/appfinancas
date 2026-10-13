import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { lancamentosParaOPeriodo, nomesDasCategorias, padraoDaEmpresa, periodoDaTela } from "@/lib/empresa/periodo-dados";
import { ComoVai } from "./ComoVai";

/**
 * "Como vai a empresa": o faturamento e o lucro em gráfico, os indicadores e as leituras do mês.
 * Com ?periodo= ou ?de=&ate= (13/10/2026), o painel do período no lugar do gráfico.
 */
export default async function ComoVaiPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const ctx = await getRequiredSession();
  const dados = await carregarEmpresa(ctx);
  if (!dados.config) redirect("/empresa");
  const periodo = sp.periodo || sp.de || sp.mes ? periodoDaTela(sp, dados.hoje, () => padraoDaEmpresa(dados)) : null;
  const [lancs, custom] = await Promise.all([periodo ? lancamentosParaOPeriodo(ctx, dados, periodo) : dados.lancamentos, nomesDasCategorias(ctx)]);
  return <ComoVai dados={dados} periodo={periodo} antigos={lancs === dados.lancamentos ? null : lancs} custom={custom} />;
}
