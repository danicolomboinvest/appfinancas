import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { lerChaveDoMes } from "@/lib/empresa/regras";
import { clientesRecentes } from "@/lib/repositories/empresa.repo";
import { somarDias } from "@/lib/empresa/regras";
import { Assistente } from "./Assistente";
import { VisaoDaEmpresa } from "./VisaoDaEmpresa";

/**
 * A Visão geral da Empresa (versão nova, 11/10/2026, protótipo "Ateliê da Ana"). Na primeira vez, o
 * assistente de 5 telas; depois, as abas Resumo, Vendas, Despesas e Contas, com o recibo do mês e o
 * "Pede sua atenção". `?aba=vendas` e `?mes=2026-09` abrem direto.
 */
export default async function EmpresaPage(props: PageProps<"/empresa">) {
  const sp = await props.searchParams;
  const ctx = await getRequiredSession();
  const dados = await carregarEmpresa(ctx);
  if (!dados.config || sp.assistente === "1") return <Assistente dados={dados} />;
  const clientes = await clientesRecentes(ctx, somarDias(dados.hoje, -120));
  const aba = typeof sp.aba === "string" && ["resumo", "vendas", "despesas", "contas"].includes(sp.aba) ? (sp.aba as "resumo" | "vendas" | "despesas" | "contas") : "resumo";
  const mes = lerChaveDoMes(typeof sp.mes === "string" ? sp.mes : null);
  return <VisaoDaEmpresa dados={dados} clientes={clientes} abaInicial={aba} mesInicial={mes} abrirRegistrar={sp.registrar === "1"} />;
}
