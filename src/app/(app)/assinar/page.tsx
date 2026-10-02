import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { situacaoDoAcesso } from "@/lib/repositories/allowedEmail.repo";
import { naAppDaApple } from "@/lib/apple/app-da-apple";
import { IDS_DOS_PRODUTOS } from "@/lib/apple/config";
import { guardarTokenApple } from "@/lib/repositories/assinaturaApple.repo";
import { AssinarPelaApple } from "@/components/auth/AssinarPelaApple";

/** A assinatura pela Apple aberta a partir de um cadeado (contas antigas do grátis no app iOS).
 * Fora do app da Apple, ou pra quem já tem acesso, não tem o que ver aqui. */
export default async function AssinarPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);
  if (!(await naAppDaApple()) || (await situacaoDoAcesso(user.email)) === "ativo") redirect("/");
  return <AssinarPelaApple token={await guardarTokenApple(user)} produtosIds={[...IDS_DOS_PRODUTOS]} />;
}
