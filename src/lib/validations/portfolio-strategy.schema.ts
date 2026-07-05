import { z } from "zod";

const STRATEGY_ASSET_CLASS_VALUES = [
  "RENDA_FIXA_POS_FIXADA",
  "RENDA_FIXA_IPCA",
  "PREFIXADO",
  "ACOES_BRASIL",
  "FIIS",
  "EXTERIOR",
  "OUTROS",
] as const;

export const portfolioStrategySchema = z
  .object({
    RENDA_FIXA_POS_FIXADA: z.coerce.number().min(0).max(100),
    RENDA_FIXA_IPCA: z.coerce.number().min(0).max(100),
    PREFIXADO: z.coerce.number().min(0).max(100),
    ACOES_BRASIL: z.coerce.number().min(0).max(100),
    FIIS: z.coerce.number().min(0).max(100),
    EXTERIOR: z.coerce.number().min(0).max(100),
    OUTROS: z.coerce.number().min(0).max(100),
  })
  .refine(
    (data) => {
      const sum = STRATEGY_ASSET_CLASS_VALUES.reduce((acc, key) => acc + data[key], 0);
      return Math.abs(sum - 100) < 0.01;
    },
    { message: "Os percentuais-alvo devem somar exatamente 100%." },
  );

export { STRATEGY_ASSET_CLASS_VALUES };
