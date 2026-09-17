import { z } from "zod";

const PARENT_CATEGORY_VALUES = [
  "MORADIA",
  "ALIMENTACAO",
  "TRANSPORTE",
  "SAUDE",
  "LAZER",
  "EDUCACAO",
  "FINANCEIRO",
] as const;

export const monthlyEntrySchema = z
  .object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  category: z.enum(["INCOME", "EXPENSE", "INVESTMENT_CONTRIBUTION"]),
  parentCategory: z.enum(PARENT_CATEGORY_VALUES).optional().or(z.literal("")),
  customCategoryId: z.string().trim().optional().or(z.literal("")),
  subcategory: z.string().trim().optional(),
  description: z.string().trim().optional(),
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
  /** Moeda em que o valor foi digitado. Vazia = a moeda do usuário, sem conversão. */
  currency: z.enum(["BRL", "USD", "EUR", "GBP"]).optional().or(z.literal("")),
  /** Cotação usada quando a moeda é outra (1 unidade da moeda digitada = X na moeda do usuário). */
  exchangeRate: z
    .union([z.coerce.number(), z.literal(""), z.undefined()])
    .transform((v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined)),
  /** Data em que a despesa/renda aconteceu (input type="date" → "YYYY-MM-DD"). Meio-dia local
   * evita a data "voltar um dia" na conversão pra UTC. */
  entryDate: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    // String fora do formato do input date viraria Invalid Date e estouraria no Prisma.
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.")
    .transform((v) => (v ? new Date(`${v}T12:00:00`) : undefined)),
  /** Meta vinculada ao lançamento (aportes). */
  goalId: z.string().trim().optional().or(z.literal("")),
  /** "on" quando o checkbox de recorrência é marcado no formulário. */
  repeatMonthly: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
})
  // Gasto sem categoria some do orçamento e do "para onde foi seu dinheiro": a pessoa lançava
  // R$ 250 no mercado e o app dizia que ela economizou R$ 250 em alimentação.
  .refine((d) => d.category !== "EXPENSE" || Boolean(d.parentCategory) || Boolean(d.customCategoryId), {
    message: "Escolha uma categoria pro gasto (Moradia, Alimentação…).",
    path: ["parentCategory"],
  });
