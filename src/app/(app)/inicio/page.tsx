import { redirect } from "next/navigation";

/** A home agora é o Fluxo — /inicio fica só como redirect para atalhos antigos não quebrarem. */
export default function InicioPage() {
  redirect("/mensal");
}
