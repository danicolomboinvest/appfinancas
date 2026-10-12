"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { updateOwnProfile, getOwnUser } from "@/lib/repositories/user.repo";
import { profileSchema } from "@/lib/validations/user-settings.schema";
import { normalizePhone } from "@/lib/phone";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { definirRendaPlanejada } from "@/lib/repositories/monthly-plan.repo";
import { mesesQueOSalvarGrava } from "@/lib/planning/plano-anual";

export type ProfileState = { error?: string };

export async function updateProfileAction(_prevState: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = profileSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
  });
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  // Campo vazio = quer remover; preenchido tem que ser um celular válido.
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) {
    return { error: "Celular inválido. Use DDD + número, ex.: (11) 98765-4321." };
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();

  // O e-mail É a chave do acesso (allowlist da compra): trocar livremente permitiria ocupar o
  // e-mail liberado de OUTRO comprador que ainda não se cadastrou, ou se trancar pra fora
  // trocando pra um e-mail sem liberação. Troca de e-mail só via suporte (admin).
  const current = await getOwnUser(ctx);
  if (parsed.data.email.trim().toLowerCase() !== current.email.toLowerCase()) {
    return {
      error: "O e-mail é o seu acesso (vinculado à compra) e não pode ser trocado por aqui. Fale com o suporte.",
    };
  }

  // A foto (avatarUrl) saiu do formulário: não aparecia em lugar nenhum do app, e apagar o
  // link nem apagava (vazio virava undefined e o Prisma ignorava).
  // Data de nascimento e renda mensal (versão nova). Vazio = não mexe na renda; nascimento vazio apaga.
  const nascTexto = String(formData.get("nascimento") ?? "").trim();
  const nascimento = /^\d{4}-\d{2}-\d{2}$/.test(nascTexto) ? new Date(`${nascTexto}T00:00:00Z`) : null;
  if (nascTexto && !nascimento) return { error: "Data de nascimento inválida." };
  const rendaTexto = String(formData.get("renda") ?? "").trim();
  const renda = rendaTexto ? Number(rendaTexto.replace(/\./g, "").replace(",", ".")) : null;
  if (rendaTexto && !(renda !== null && renda >= 0 && renda < 1e8)) return { error: "Renda inválida." };

  await updateOwnProfile(ctx, {
    name: parsed.data.name,
    phone,
    nascimento,
  });
  if (renda !== null) {
    const agora = nowInBrazil();
    await definirRendaPlanejada(ctx, agora.getFullYear(), renda, mesesQueOSalvarGrava(agora.getFullYear(), agora));
  }
  revalidatePath("/configuracoes/perfil");
  revalidatePath("/configuracoes");
  return {};
}

export type RendaState = { error?: string; ok?: boolean };

/** "Renda e dia do pagamento": a renda do plano (deste mês em diante) e o dia em que ela cai. */
export async function salvarRendaAction(_prev: RendaState, formData: FormData): Promise<RendaState> {
  const ctx = await getRequiredSession();
  const rendaTexto = String(formData.get("renda") ?? "").trim();
  const renda = Number(rendaTexto.replace(/\./g, "").replace(",", "."));
  if (!rendaTexto || !(renda >= 0 && renda < 1e8)) return { error: "Coloque a renda do mês." };
  const dia = Number(formData.get("dia"));
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return { error: "O dia do pagamento vai de 1 a 31." };
  const agora = nowInBrazil();
  await definirRendaPlanejada(ctx, agora.getFullYear(), renda, mesesQueOSalvarGrava(agora.getFullYear(), agora));
  await updateOwnProfile(ctx, { diaDoPagamento: dia });
  revalidatePath("/configuracoes");
  revalidatePath("/orcamento", "layout");
  revalidatePath("/mensal", "layout");
  return { ok: true };
}
