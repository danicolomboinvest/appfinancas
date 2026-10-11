import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { chaveDoMes, lerChaveDoMes, reciboDoMes } from "@/lib/empresa/regras";
import { resumoDaEmpresa } from "@/lib/empresa/resumo";
import { Holerite } from "./Holerite";

/**
 * Seu salário: o holerite do mês fechado e o "Transferir para o Pessoal" (vira entrada no Pessoal).
 * `?mes=2026-09`; sem mês, o último fechado.
 */
export default async function SalarioPage(props: PageProps<"/empresa/salario">) {
  const sp = await props.searchParams;
  const ctx = await getRequiredSession();
  const dados = await carregarEmpresa(ctx);
  if (!dados.config) redirect("/empresa");
  const R = resumoDaEmpresa(dados);
  const pedido = lerChaveDoMes(typeof sp.mes === "string" ? sp.mes : null);
  const ord = (m: { ano: number; mes: number }) => m.ano * 12 + m.mes;
  const mes = pedido && ord(pedido) < ord(dados.mesAtual) ? pedido : R.ultimoFechado;
  const recibo = reciboDoMes(dados.lancamentos, mes);
  const pago = dados.lancamentos.find((l) => l.externalId === `prolabore:${chaveDoMes(mes)}`)?.amount ?? null;
  const salario = pago ?? Math.min(R.salario, Math.max(0, recibo.sobrou));
  return (
    <Holerite
      mes={mes}
      empresa={dados.nome}
      pessoa={dados.nomeCompleto}
      lucro={recibo.sobrou}
      salario={salario}
      pago={pago !== null}
      temPessoal={dados.pessoal !== null}
      pessoalId={dados.pessoal?.id ?? null}
      negocio={dados.negocio}
    />
  );
}
