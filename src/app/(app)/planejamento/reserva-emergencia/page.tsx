import { redirect } from "next/navigation";

/**
 * O simulador da Reserva saiu do app (decisão da dona, 11/10/2026). Os dados guardados ficam (a
 * Estratégia da Carteira e o Decidir ainda leem a reserva salva); o link antigo leva para Metas.
 */
export default function Page() {
  redirect("/planejamento/metas");
}
