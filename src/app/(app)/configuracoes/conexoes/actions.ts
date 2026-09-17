"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createConnectToken, deleteItem, findMeuPluggyConnectorId, getItem, isPluggyConfigured, triggerItemUpdate } from "@/lib/pluggy/client";
import { syncConnection, type SyncResult } from "@/lib/pluggy/sync";

export async function createConnectTokenAction(): Promise<{ ok: true; token: string; connectorId: number | null } | { ok: false; error: string }> {
  const ctx = await getRequiredSession();
  if (!isPluggyConfigured()) return { ok: false, error: "A conexão com bancos ainda não está configurada neste app." };
  try {
    const [token, connectorId] = await Promise.all([createConnectToken(ctx.userId), findMeuPluggyConnectorId().catch(() => null)]);
    return { ok: true, token, connectorId };
  } catch (err) {
    console.error("createConnectTokenAction:", err);
    return { ok: false, error: "Não consegui falar com o serviço de conexão agora. Tente de novo em instantes." };
  }
}

/** O widget devolveu um item: guarda a conexão e faz a primeira busca (últimos 90 dias). */
export async function registerConnectionAction(itemId: string): Promise<{ ok: true; result: SyncResult; connectorName: string } | { ok: false; error: string }> {
  const ctx = await getRequiredSession();
  if (!itemId) return { ok: false, error: "Conexão inválida." };
  try {
    const item = await getItem(itemId);
    const conn = await prisma.bankConnection.upsert({
      where: { itemId },
      update: { userId: ctx.userId, status: item.status, connectorName: item.connector?.name ?? "Banco", connectorId: item.connector?.id ?? null },
      create: { userId: ctx.userId, itemId, status: item.status, connectorName: item.connector?.name ?? "Banco", connectorId: item.connector?.id ?? null },
    });
    const result = await syncConnection(ctx, conn.id);
    revalidatePath("/configuracoes/conexoes");
    revalidatePath("/mensal");
    return { ok: true, result, connectorName: conn.connectorName };
  } catch (err) {
    console.error("registerConnectionAction:", err);
    return { ok: false, error: "A conexão foi criada, mas não consegui buscar os lançamentos. Tente \"Buscar agora\" em instantes." };
  }
}

export async function syncConnectionAction(id: string): Promise<{ ok: true; result: SyncResult } | { ok: false; error: string }> {
  const ctx = await getRequiredSession();
  try {
    const conn = await prisma.bankConnection.findFirst({ where: { id, userId: ctx.userId } });
    if (!conn) return { ok: false, error: "Conexão não encontrada." };
    await triggerItemUpdate(conn.itemId);
    const result = await syncConnection(ctx, id);
    revalidatePath("/configuracoes/conexoes");
    revalidatePath("/mensal");
    return { ok: true, result };
  } catch (err) {
    console.error("syncConnectionAction:", err);
    await prisma.bankConnection.updateMany({ where: { id, userId: ctx.userId }, data: { lastError: String((err as Error).message).slice(0, 200) } });
    return { ok: false, error: "Não consegui buscar agora. O banco pode estar reautenticando; tente mais tarde." };
  }
}

export async function disconnectAction(id: string): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const conn = await prisma.bankConnection.findFirst({ where: { id, userId: ctx.userId } });
  if (!conn) return { ok: false };
  await deleteItem(conn.itemId);
  await prisma.bankConnection.delete({ where: { id: conn.id } });
  revalidatePath("/configuracoes/conexoes");
  return { ok: true };
}
