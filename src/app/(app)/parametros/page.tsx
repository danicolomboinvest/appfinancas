import { redirect } from "next/navigation";

/** Rota antiga, as Taxas do Sistema agora vivem dentro de Configurações. */
export default function ParametrosRedirectPage() {
  redirect("/configuracoes/taxas");
}
