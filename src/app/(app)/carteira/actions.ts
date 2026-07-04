"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { createAsset, deleteOwnAsset } from "@/lib/repositories/asset.repo";
import { assetSchema } from "@/lib/validations/asset.schema";

export type AssetFormState = { error?: string };

export async function createAssetAction(_prevState: AssetFormState, formData: FormData): Promise<AssetFormState> {
  const parsed = assetSchema.safeParse({
    name: formData.get("name"),
    ticker: formData.get("ticker") || undefined,
    assetClass: formData.get("assetClass"),
    objective: formData.get("objective"),
    goalId: formData.get("goalId") || undefined,
    currentValue: formData.get("currentValue"),
    idealAllocationPercent: formData.get("idealAllocationPercent") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await createAsset(ctx, parsed.data);
  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
  return {};
}

export async function deleteAssetAction(id: string) {
  const ctx = await getRequiredSession();
  await deleteOwnAsset(ctx, id);
  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
}
