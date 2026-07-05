"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { createReferenceRate, deleteOwnReferenceRate } from "@/lib/repositories/reference-rate.repo";
import { referenceRateSchema } from "@/lib/validations/reference-rate.schema";

export type ReferenceRateState = { error?: string };

export async function createReferenceRateAction(
  _prevState: ReferenceRateState,
  formData: FormData,
): Promise<ReferenceRateState> {
  const parsed = referenceRateSchema.safeParse({
    name: formData.get("name"),
    rateValue: formData.get("rateValue"),
    basis: formData.get("basis"),
    effectiveDate: formData.get("effectiveDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await createReferenceRate(ctx, parsed.data);
  revalidatePath("/configuracoes/taxas");
  return {};
}

export async function deleteReferenceRateAction(id: string) {
  const ctx = await getRequiredSession();
  await deleteOwnReferenceRate(ctx, id);
  revalidatePath("/configuracoes/taxas");
}
