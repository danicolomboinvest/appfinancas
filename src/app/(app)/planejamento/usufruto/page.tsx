import { redirect } from "next/navigation";

/** Acúmulo, Liberdade Financeira e Projeção Patrimonial foram unificados em
 * /planejamento/acumulo — mantém o link antigo funcionando. */
export default function UsufrutoRedirectPage() {
  redirect("/planejamento/acumulo#liberdade-financeira");
}
