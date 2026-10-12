import { z } from "zod";

export const createAnalysisSheetSchema = z
  .object({
    sheetType: z.enum(["STOCK", "FII", "STOCK_INTL", "ETF"]),
    ticker: z.string().trim().min(1, "Informe o ticker."),
    companyName: z.string().trim().optional(),
    fiiType: z.enum(["TIJOLO", "PAPEL", "HIBRIDO", "FUNDO_DE_FUNDOS"]).optional(),
  })
  .refine((data) => data.sheetType !== "FII" || !!data.fiiType, {
    message: "Selecione o tipo de FII.",
    path: ["fiiType"],
  });

export type CreateAnalysisSheetInput = z.infer<typeof createAnalysisSheetSchema>;
