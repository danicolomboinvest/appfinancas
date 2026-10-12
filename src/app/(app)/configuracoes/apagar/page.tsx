import { DeleteAccountSection } from "../dados/DeleteAccountSection";
import { getRequiredSession } from "@/lib/auth/session";
import { naAppDaApple } from "@/lib/apple/app-da-apple";
import { prisma } from "@/lib/db/prisma";

/** "Apagar minha conta" numa tela à parte (protótipo: Exportar e Apagar não moram juntos). */
export default async function ApagarContaPage() {
  const ctx = await getRequiredSession();
  // Aviso de que excluir a conta não cancela a assinatura: no app iOS, ou pra quem assinou por lá.
  const avisoDaApple = (await naAppDaApple()) || (await prisma.assinaturaApple.count({ where: { userId: ctx.userId, revogadaEm: null } })) > 0;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="titulo-tema text-2xl font-medium text-ink">Apagar minha conta</h1>
      <p className="-mt-2 text-sm text-ink-muted">Se quiser guardar algo, exporte antes.</p>
      <DeleteAccountSection avisoDaApple={avisoDaApple} />
    </div>
  );
}
