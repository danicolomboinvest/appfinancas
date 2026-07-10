"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { upsertPlanningParams } from "@/lib/repositories/planning-params.repo";
import { planningParamsSchema } from "@/lib/validations/planning-params.schema";

export type PlanningParamsState = { error?: string };

export async function savePlanningParamsAction(
  _prevState: PlanningParamsState,
  formData: FormData,
): Promise<PlanningParamsState> {
  const raw = {
    currentAge: formData.get("currentAge"),
    retirementAge: formData.get("retirementAge"),
    lifeExpectancyAge: formData.get("lifeExpectancyAge") || undefined,
    currentPatrimony: formData.get("currentPatrimony"),
    monthlyContributionAccumulation: formData.get("monthlyContributionAccumulation"),
    accumulationAnnualRate: formData.get("accumulationAnnualRate"),
    inflationAnnualRate: formData.get("inflationAnnualRate"),
    usufructAnnualRate: formData.get("usufructAnnualRate"),
    desiredPassiveIncome: formData.get("desiredPassiveIncome"),
    otherPassiveIncome: formData.get("otherPassiveIncome") || 0,
  };

  const parsed = planningParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await upsertPlanningParams(ctx, parsed.data);
  revalidatePath("/planejamento/acumulo");
  return {};
}
