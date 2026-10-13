import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { lancamentosParaOPeriodo, nomesDasCategorias, padraoDaEmpresa, periodoDaTela } from "@/lib/empresa/periodo-dados";
import { clientesRecentes } from "@/lib/repositories/empresa.repo";
import { somarDias } from "@/lib/empresa/regras";
import { Assistente } from "./Assistente";
import { VisaoDaEmpresa } from "./VisaoDaEmpresa";

/**
 * A Visão geral da Empresa (versão nova, 11/10/2026, protótipo "Ateliê da Ana"). Na primeira vez, o
 * assistente de 5 telas; depois, as abas Resumo, Vendas, Despesas e Contas, com o recibo do mês e o
 * "Pede sua atenção". `?aba=vendas` abre direto. O período (13/10/2026): `?periodo=mes|mes-passado|
 * ano|12m` ou `?de=&ate=`; o `?mes=2026-09` de antes continua abrindo aquele mês. Sem nada: o último
 * mês fechado (ou o de hoje, se o fechado não tem lançamento), como sempre.
 */
export default async function EmpresaPage(props: PageProps<"/empresa">) {
  const sp = await props.searchParams;
  const ctx = await getRequiredSession();
  const dados = await carregarEmpresa(ctx);
  if (!dados.config || sp.assistente === "1") return <Assistente dados={dados} />;
  const periodo = periodoDaTela(sp, dados.hoje, () => padraoDaEmpresa(dados));
  const [clientes, lancs, custom] = await Promise.all([clientesRecentes(ctx, somarDias(dados.hoje, -120)), lancamentosParaOPeriodo(ctx, dados, periodo), nomesDasCategorias(ctx)]);
  const aba = typeof sp.aba === "string" && ["resumo", "vendas", "despesas", "contas"].includes(sp.aba) ? (sp.aba as "resumo" | "vendas" | "despesas" | "contas") : "resumo";
  return (
    <VisaoDaEmpresa
      dados={dados}
      clientes={clientes}
      abaInicial={aba}
      periodo={periodo}
      antigos={lancs === dados.lancamentos ? null : lancs}
      custom={custom}
      abrirRegistrar={sp.registrar === "1"}
    />
  );
}
