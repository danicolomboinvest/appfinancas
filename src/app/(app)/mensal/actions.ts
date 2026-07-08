"use server";

import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";

export async function getRecentSubcategoriesAction(): Promise<Record<ParentCategory, string[]>> {
  const ctx = await getRequiredSession();
  return listRecentSubcategories(ctx);
}
