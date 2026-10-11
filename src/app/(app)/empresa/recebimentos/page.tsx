import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { resumoDaEmpresa } from "@/lib/empresa/resumo";
import { Recebimentos } from "./Recebimentos";

/** Recebimentos: o que vai entrar nas próximas 4 semanas e quem está devendo. */
export default async function RecebimentosPage() {
  const ctx = await getRequiredSession();
  const dados = await carregarEmpresa(ctx);
  if (!dados.config) redirect("/empresa");
  const R = resumoDaEmpresa(dados);
  return <Recebimentos nome={dados.nome} semanas={R.semanas} devendo={R.devendo} />;
}
