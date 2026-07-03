"use server";

import { redirect } from "next/navigation";
import { createUser, findUserByEmail } from "@/lib/repositories/user.repo";
import { registerSchema } from "@/lib/validations/auth.schema";

export type RegisterState = { error?: string };

export async function registerAction(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) {
    return { error: "Já existe uma conta com este email." };
  }

  await createUser(parsed.data);
  redirect("/login");
}
