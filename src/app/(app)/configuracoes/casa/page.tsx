import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { acertoDaCasa } from "@/lib/repositories/casa.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { Cabecalho } from "../_ajustes/Lista";
import { ConfigDaCasa } from "./ConfigDaCasa";

export const metadata = { title: "Casa · Configurações" };

/** Configurações › Casa (Casal simples): nomes, jeito de dividir, o que o par vê e a saída. */
export default async function ConfigDaCasaPage() {
  const ctx = await getRequiredSession();
  if (!ctx.casa) notFound();
  const agora = nowInBrazil();
  const acerto = await acertoDaCasa(ctx, agora.getFullYear(), agora.getMonth() + 1);
  return (
    <div className="flex flex-col gap-2">
      <Cabecalho titulo="Casa" />
      <ConfigDaCasa eu={ctx.casa.eu.nome} outro={ctx.casa.outro.nome} souTitular={ctx.casa.eu.papel === "titular"} divisao={acerto?.config.divisao ?? "renda"} />
    </div>
  );
}
