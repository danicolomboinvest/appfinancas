"use server";

import bcrypt from "bcryptjs";
import { signOut } from "@/lib/auth/auth.config";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteUserAndAllData } from "@/lib/repositories/delete-account.repo";

export type DeleteAccountState = { error?: string };

/**
 * Exclusão definitiva da conta (direito LGPD): apaga TODOS os dados do usuário numa única
 * transação, na ordem que respeita as chaves estrangeiras (lançamentos/ativos antes de
 * metas/categorias; usuário por último). Exige a senha atual como confirmação.
 */
export async function deleteAccountAction(
  _prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const ctx = await getRequiredSession();
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Digite sua senha para confirmar." };

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { passwordHash: true } });
  if (!user) return { error: "Conta não encontrada." };

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return { error: "Senha incorreta." };

  await deleteUserAndAllData(ctx.userId);

  // Encerra a sessão e manda pro login (redireciona via exceção do Next).
  await signOut({ redirectTo: "/login" });
  return {};
}
