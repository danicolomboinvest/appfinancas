import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { resumoDaEmpresa } from "@/lib/empresa/resumo";
import { ConfigDaEmpresa } from "./ConfigDaEmpresa";

/** Configurações da empresa: salário, lembrete da guia, taxas da maquininha e horas de trabalho. */
export default async function ConfiguracoesDaEmpresaPage() {
  const ctx = await getRequiredSession();
  const dados = await carregarEmpresa(ctx);
  if (!dados.config) redirect("/empresa");
  const R = resumoDaEmpresa(dados);
  return <ConfigDaEmpresa nome={dados.nome} config={dados.config} seguro={R.seguro} temGuia={!!dados.legal.diaDoDas} />;
}
