"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { estadoDaAssessoria, estadoDepoisDaEquipe } from "./estado";

/** /admin/assessoria: a equipe marca o que o assessor achou na EQI. */
export async function decidirAssessoriaAction(userId: string, decisao: "confirmar" | "nao_achou" | "desfazer"): Promise<{ ok: boolean }> {
  await requireAdmin();
  const v = z.object({ userId: z.string().min(1), decisao: z.enum(["confirmar", "nao_achou", "desfazer"]) }).safeParse({ userId, decisao });
  if (!v.success) return { ok: false };
  const atual = await prisma.user.findUnique({ where: { id: v.data.userId }, select: { assessoriaEstado: true } });
  if (!atual) return { ok: false };
  const novo = estadoDepoisDaEquipe(estadoDaAssessoria(atual.assessoriaEstado), v.data.decisao);
  if (!novo) return { ok: false };
  await prisma.user.update({
    where: { id: v.data.userId },
    data: { assessoriaEstado: novo === "nao_cliente" ? null : novo, assessoriaEstadoEm: new Date() },
  });
  revalidatePath("/admin/assessoria");
  revalidatePath("/carteira");
  revalidatePath("/carteira/oportunidades");
  return { ok: true };
}
