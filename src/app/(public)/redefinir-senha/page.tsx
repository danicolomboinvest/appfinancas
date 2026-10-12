import { verifyPasswordResetToken } from "@/lib/auth/password-reset";
import { NovaSenha } from "./NovaSenha";

/**
 * Destino do link "Criar nova senha" do e-mail. A página olha o código ANTES de pedir a senha
 * (só confere, não gasta: quem gasta é a troca, em actions.ts), para quem abriu um link vencido
 * saber disso de cara, e não depois de digitar a senha duas vezes. A troca confere de novo.
 */
export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const linkValido = token ? (await verifyPasswordResetToken(token)) !== null : false;
  return <NovaSenha token={token} linkValido={linkValido} />;
}
