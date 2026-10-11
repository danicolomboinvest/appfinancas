import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { ComoVai } from "./ComoVai";

/** "Como vai a empresa": o faturamento e o lucro em gráfico, os indicadores e as leituras do mês. */
export default async function ComoVaiPage() {
  const ctx = await getRequiredSession();
  const dados = await carregarEmpresa(ctx);
  if (!dados.config) redirect("/empresa");
  return <ComoVai dados={dados} />;
}
