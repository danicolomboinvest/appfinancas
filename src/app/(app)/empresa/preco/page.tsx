import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { resumoDaEmpresa } from "@/lib/empresa/resumo";
import { ramoDe } from "@/lib/empresa/config";
import { QuantoCobrar } from "./QuantoCobrar";

/** Quanto cobrar (Preço certo): 3 telas e a etiqueta com o preço mínimo. */
export default async function PrecoPage() {
  const ctx = await getRequiredSession();
  const dados = await carregarEmpresa(ctx);
  if (!dados.config) redirect("/empresa");
  const R = resumoDaEmpresa(dados);
  const ramo = ramoDe(dados.config.faz);
  // As contas de cada unidade: contas do mês + guia, divididas pelas vendas do último mês fechado.
  const contasDoMes = R.reciboFechado.fixas + (R.guia?.valor ?? R.reciboFechado.impostos);
  return (
    <QuantoCobrar
      nome={dados.nome}
      produto={ramo?.produto ?? "Seu produto"}
      materiais={ramo?.materiais ?? "Materiais"}
      foto={ramo?.foto ?? null}
      salario={R.salario}
      horasPorMes={dados.config.horasPorMes}
      contasDoMes={contasDoMes}
      vendasDoMes={R.reciboFechado.nVendas}
      taxaCredito={dados.config.taxas.credito}
      ehMei={R.ehMei}
      pe={R.pe}
    />
  );
}
