import { z } from "zod";

export const assetSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do ativo."),
  ticker: z.string().trim().optional(),
  assetClass: z.enum(["RENDA_FIXA", "ACAO", "FII", "TESOURO_DIRETO", "FUNDO", "CRIPTO", "INTERNACIONAL", "OUTRO"]),
  objective: z.enum(["RESERVA_EMERGENCIA", "LIBERDADE_FINANCEIRA", "META", "OUTRO"]),
  goalId: z.string().trim().optional(),
  quantity: z.coerce.number().min(0).optional(),
  currentUnitPrice: z.coerce.number().min(0).optional(),
  /** Quanto foi investido, referência fixa do lucro; a atualização de cotação nunca altera. */
  investedValue: z.coerce.number().min(0).optional(),
  /** Indexador da renda fixa (pós/IPCA/prefixado). Vazio quando não se aplica/desconhecido. */
  fixedIncomeIndex: z
    .enum(["POS_FIXADO", "IPCA", "PREFIXADO"])
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  /** String vazia vira 0 no z.coerce (o erro nunca aparecia): apagar o campo salvava um ativo
   * de R$ 40.000 como R$ 0,00 e ele sumia do patrimônio sem avisar. */
  currentValue: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? NaN : v),
    z.coerce.number({ message: "Informe o valor atual ou a quantidade e o preço médio." }).min(0),
  ),
  idealAllocationPercent: z.coerce.number().min(0).max(1).optional(),
  acquisitionDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});
