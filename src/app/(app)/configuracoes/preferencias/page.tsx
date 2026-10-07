import { redirect } from "next/navigation";

/** Perfil e Preferências moram na tela de Configurações desde 07/10/2026 (cadastro no topo, modo e moeda num toque). */
export default function Page() {
  redirect("/configuracoes");
}
