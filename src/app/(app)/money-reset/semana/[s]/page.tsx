import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { lerReset } from "@/lib/repositories/money-reset.repo";
import { Historinha } from "./Historinha";

/**
 * A historinha que abre cada semana do mapa (proposta A+B, vinda do caminho C): a Lu, uma conta que
 * não fecha e um painel que reage ao toque. Os números são da Lu, da história, e a tela diz isso.
 * No fim, "Agora é a minha vez" leva à primeira missão da semana (ou ao mapa, se ela já passou dela).
 */
export default async function SemanaPage(props: PageProps<"/money-reset/semana/[s]">) {
  const { s: param } = await props.params;
  const s = Number(param);
  if (s !== 1 && s !== 2 && s !== 3) notFound();
  const ctx = await getRequiredSession();
  if (!(await temMoneyReset(ctx.userId))) notFound();
  const reset = await lerReset(ctx);
  // Semana na névoa só abre para a Dani (ADMIN), para conferir.
  if (s > reset.estado.semana && ctx.role !== "ADMIN") notFound();
  const primeiro = (s - 1) * 7 + 1;
  const destino = reset.estado.atual !== null && reset.estado.atual >= primeiro && reset.estado.atual < primeiro + 7 ? `/money-reset/dia/${reset.estado.atual}` : "/money-reset";
  return <Historinha semana={s} destino={destino} />;
}
