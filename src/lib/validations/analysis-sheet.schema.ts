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

// Campo ausente = não mexe; `null` = ela apagou (limpa no banco). Sem o null, apagar uma nota
// não salvava e o valor antigo voltava ao reabrir a ficha.
export const analysisResponseSchema = z.object({
  criterionId: z.string(),
  value: z.string().trim().nullable().optional(),
  score: z.number().min(0).max(10).nullable().optional(),
  note: z.string().trim().nullable().optional(),
});

export const saveAnalysisResponsesSchema = z.object({
  sheetId: z.string(),
  conclusion: z.string().trim().nullable().optional(),
  responses: z.array(analysisResponseSchema),
});

export type SaveAnalysisResponsesInput = z.infer<typeof saveAnalysisResponsesSchema>;
