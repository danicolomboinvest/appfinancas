import { redirect } from "next/navigation";
import { nowInBrazil } from "@/lib/date/brazil-now";

/** Aterrissa direto no MÊS atual (não no consolidado do ano): é onde vivem o checklist de
 * primeiros passos, o formulário de lançamento, o orçamento do mês e o recap semanal, a tela
 * que uma pessoa nova precisa ver primeiro. O consolidado anual continua acessível pelo
 * breadcrumb (Fluxo Financeiro › ano). Fuso do Brasil, não o do servidor. */
export default function MensalPage() {
  const now = nowInBrazil();
  redirect(`/mensal/${now.getFullYear()}/${now.getMonth() + 1}`);
}
