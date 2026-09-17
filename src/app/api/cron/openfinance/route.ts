import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isPluggyConfigured } from "@/lib/pluggy/client";
import { syncConnection } from "@/lib/pluggy/sync";

export const maxDuration = 300;

/** Toda noite: busca lançamentos novos de todos os bancos conectados. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPluggyConfigured()) return NextResponse.json({ ok: true, skipped: "not configured" });

  const connections = await prisma.bankConnection.findMany({ include: { user: { select: { role: true } } } });
  let created = 0;
  let failed = 0;
  for (const c of connections) {
    try {
      const r = await syncConnection({ userId: c.userId, role: c.user.role }, c.id);
      created += r.created;
    } catch (err) {
      failed += 1;
      await prisma.bankConnection.update({ where: { id: c.id }, data: { lastError: String((err as Error).message).slice(0, 200) } }).catch(() => undefined);
    }
  }
  return NextResponse.json({ ok: true, connections: connections.length, created, failed });
}
