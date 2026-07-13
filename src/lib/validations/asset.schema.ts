import { z } from "zod";

export const assetSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do ativo."),
  ticker: z.string().trim().optional(),
  assetClass: z.enum(["RENDA_FIXA", "ACAO", "FII", "TESOURO_DIRETO", "FUNDO", "CRIPTO", "OUTRO"]),
  objective: z.enum(["RESERVA_EMERGENCIA", "LIBERDADE_FINANCEIRA", "META", "OUTRO"]),
  goalId: z.string().trim().optional(),
  quantity: z.coerce.number().min(0).optional(),
  currentUnitPrice: z.coerce.number().min(0).optional(),
  /** Quanto foi investido — referência fixa do lucro; a atualização de cotação nunca altera. */
  investedValue: z.coerce.number().min(0).optional(),
  currentValue: z.coerce.number().min(0),
  idealAllocationPercent: z.coerce.number().min(0).max(1).optional(),
  acquisitionDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});
