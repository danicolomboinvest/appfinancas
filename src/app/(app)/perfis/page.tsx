import { redirect } from "next/navigation";

/** A tela antiga "Seus perfis" (Usar, Mexer e lixeira) virou Configurações › Perfis: uma tela só. */
export default function PerfisPage() {
  redirect("/configuracoes/perfis");
}
