"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { updateOwnNotificationPrefs } from "@/lib/repositories/user.repo";
import { notificationsSchema } from "@/lib/validations/user-settings.schema";

export type NotificationsState = { error?: string };

export async function updateNotificationsAction(
  _prevState: NotificationsState,
  formData: FormData,
): Promise<NotificationsState> {
  const parsed = notificationsSchema.safeParse({
    notifyBudgetAlerts: formData.get("notifyBudgetAlerts") ?? undefined,
    notifyLateGoals: formData.get("notifyLateGoals") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await updateOwnNotificationPrefs(ctx, parsed.data);
  revalidatePath("/configuracoes/notificacoes");
  revalidatePath("/fichas");
  return {};
}
