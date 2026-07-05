"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { savePortfolioStrategy } from "@/lib/repositories/portfolio-strategy.repo";
import { portfolioStrategySchema, STRATEGY_ASSET_CLASS_VALUES } from "@/lib/validations/portfolio-strategy.schema";

export type PortfolioStrategyState = { error?: string };

export async function savePortfolioStrategyAction(
  _prevState: PortfolioStrategyState,
  formData: FormData,
): Promise<PortfolioStrategyState> {
  const parsed = portfolioStrategySchema.safeParse({
    RENDA_FIXA_POS_FIXADA: formData.get("RENDA_FIXA_POS_FIXADA"),
    RENDA_FIXA_IPCA: formData.get("RENDA_FIXA_IPCA"),
    PREFIXADO: formData.get("PREFIXADO"),
    ACOES_BRASIL: formData.get("ACOES_BRASIL"),
    FIIS: formData.get("FIIS"),
    EXTERIOR: formData.get("EXTERIOR"),
    OUTROS: formData.get("OUTROS"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await savePortfolioStrategy(
    ctx,
    STRATEGY_ASSET_CLASS_VALUES.map((assetClass) => ({ assetClass, targetPercent: parsed.data[assetClass] / 100 })),
  );
  revalidatePath("/carteira/estrategia");
  revalidatePath("/carteira/por-objetivo");
  return {};
}
