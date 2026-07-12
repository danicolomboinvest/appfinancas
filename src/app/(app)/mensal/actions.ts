"use server";

import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listGoals } from "@/lib/repositories/goal.repo";

export async function getRecentSubcategoriesAction(): Promise<Record<ParentCategory, string[]>> {
  const ctx = await getRequiredSession();
  return listRecentSubcategories(ctx);
}

export async function getCustomCategoriesAction(): Promise<{ id: string; name: string }[]> {
  const ctx = await getRequiredSession();
  const categories = await listCustomCategories(ctx);
  return categories.map((c) => ({ id: c.id, name: c.name }));
}

export async function getGoalsAction(): Promise<{ id: string; name: string }[]> {
  const ctx = await getRequiredSession();
  const goals = await listGoals(ctx);
  return goals.map((g) => ({ id: g.id, name: g.name }));
}
