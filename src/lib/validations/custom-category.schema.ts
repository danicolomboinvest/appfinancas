import { z } from "zod";
import { CUSTOM_CATEGORY_ICON_KEYS } from "@/lib/categories";

export const customCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dê um nome pra categoria.")
    .max(30, "Nome muito longo (máx. 30 caracteres)."),
  icon: z.string().refine((v) => CUSTOM_CATEGORY_ICON_KEYS.includes(v), "Escolha um ícone."),
});
