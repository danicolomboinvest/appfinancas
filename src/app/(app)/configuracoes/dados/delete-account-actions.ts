"use server";

import bcrypt from "bcryptjs";
import { signOut } from "@/lib/auth/auth.config";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteUserAndAllData } from "@/lib/repositories/delete-account.repo";
import { deleteItem, isPluggyConfigured } from "@/lib/pluggy/client";

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

  // Os bancos conectados são revogados na Pluggy ANTES de apagar: a linha BankConnection some
  // em cascata com a conta, e sem ela o app perde o itemId pra sempre — a Pluggy continuaria
  // com acesso ao extrato dela (e cobrando o item), contra a promessa de exclusão total.
  // Melhor esforço e com teto: a Pluggy fora do ar não pode impedir ninguém de excluir a conta.
  if (isPluggyConfigured()) {
    const conexoes = await prisma.bankConnection.findMany({ where: { userId: ctx.userId }, select: { itemId: true } });
    await Promise.allSettled(
      conexoes.map((c) =>
        Promise.race([deleteItem(c.itemId), new Promise<void>((resolve) => setTimeout(resolve, 8000))]),
      ),
    );
  }

  await deleteUserAndAllData(ctx.userId);

  // Encerra a sessão e manda pro login (redireciona via exceção do Next).
  await signOut({ redirectTo: "/login" });
  return {};
}
