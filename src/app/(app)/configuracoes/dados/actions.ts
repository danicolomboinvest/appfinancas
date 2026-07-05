"use server";

import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Exporta todos os lançamentos mensais do usuário em CSV (ano, mês, categoria, categoria-mãe, subcategoria, descrição, valor). */
export async function exportEntriesCsvAction(): Promise<string> {
  const ctx = await getRequiredSession();
  const entries = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId },
    orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
  });

  const header = ["Ano", "Mês", "Categoria", "Categoria-mãe", "Subcategoria", "Descrição", "Valor"];
  const rows = entries.map((entry) =>
    [
      String(entry.year),
      String(entry.month),
      entry.category,
      entry.parentCategory ? PARENT_CATEGORY_LABEL[entry.parentCategory] : "",
      entry.subcategory ?? "",
      entry.description ?? "",
      String(entry.amount),
    ]
      .map(csvEscape)
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}
