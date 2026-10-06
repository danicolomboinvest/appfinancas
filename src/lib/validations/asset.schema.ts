import { z } from "zod";

/** Limites das colunas do banco (Decimal 18,2 e 18,6): passar disso estourava com "numeric field
 * overflow" e a pessoa via erro de servidor em vez de uma mensagem. Ficam bem abaixo do teto. */
export const MAX_VALOR_ATIVO = 1e13;
export const MAX_QUANTIDADE_ATIVO = 1e11;
const FORA = "Esse número é grande demais. Confira se não colou o valor errado (CPF, código ou vírgula no lugar).";

export const assetSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do ativo."),
  ticker: z.string().trim().optional(),
  assetClass: z.enum(["RENDA_FIXA", "ACAO", "FII", "TESOURO_DIRETO", "FUNDO", "CRIPTO", "INTERNACIONAL", "OUTRO"]),
  objective: z.enum(["RESERVA_EMERGENCIA", "LIBERDADE_FINANCEIRA", "META", "OUTRO"]),
  goalId: z.string().trim().optional(),
  quantity: z.coerce.number().min(0).max(MAX_QUANTIDADE_ATIVO, FORA).optional(),
  currentUnitPrice: z.coerce.number().min(0).max(MAX_VALOR_ATIVO, FORA).optional(),
  /** Quanto foi investido, referência fixa do lucro; a atualização de cotação nunca altera. */
  investedValue: z.coerce.number().min(0).max(MAX_VALOR_ATIVO, FORA).optional(),
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
    z.coerce.number({ message: "Informe o valor atual ou a quantidade e o preço médio." }).min(0).max(MAX_VALOR_ATIVO, FORA),
  ),
  idealAllocationPercent: z.coerce.number().min(0).max(1).optional(),
  acquisitionDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
})
  // Objetivo "Meta" sem a meta escolhida deixava o ativo fora de todos os cards do "Por
  // objetivo" (não é reserva, nem liberdade, nem "sem objetivo", nem de meta nenhuma).
  .superRefine((v, ctx) => {
    if (v.objective === "META" && !v.goalId) {
      ctx.addIssue({ code: "custom", path: ["goalId"], message: "Escolha a meta desse ativo." });
    }
  });
