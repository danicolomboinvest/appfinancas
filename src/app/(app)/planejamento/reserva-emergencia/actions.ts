"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { upsertEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { emergencyFundSchema } from "@/lib/validations/emergency-fund.schema";

export type EmergencyFundState = { error?: string };

export async function saveEmergencyFundAction(
  _prevState: EmergencyFundState,
  formData: FormData,
): Promise<EmergencyFundState> {
  const parsed = emergencyFundSchema.safeParse({
    targetMonths: formData.get("targetMonths"),
    monthlyExpenseBase: formData.get("monthlyExpenseBase"),
    currentAmount: formData.get("currentAmount"),
    monthlyContribution: formData.get("monthlyContribution"),
    annualRate: formData.get("annualRate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await upsertEmergencyFund(ctx, parsed.data);
  revalidatePath("/planejamento/reserva-emergencia");
  return {};
}
