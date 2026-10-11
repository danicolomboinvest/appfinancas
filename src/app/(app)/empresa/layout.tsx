import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";

/**
 * A área da Empresa (versão nova, 11/10/2026) só existe no perfil Empresa. Quem troca para o Pessoal
 * com uma tela daqui aberta volta para a Visão geral dele.
 */
export default async function EmpresaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequiredSession();
  if (!ehEmpresa(ctx.profileKind)) redirect("/mensal/foco");
  return <div className="mx-auto flex w-full max-w-xl flex-col gap-4">{children}</div>;
}
