"use server";

import { getRequiredSession } from "@/lib/auth/session";
import { listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";

export async function getRecentSubcategoriesAction(): Promise<string[]> {
  const ctx = await getRequiredSession();
  return listRecentSubcategories(ctx);
}
