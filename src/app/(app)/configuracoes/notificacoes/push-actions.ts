"use server";

import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { sendPushToUser } from "@/lib/push/send";

export async function savePushSubscriptionAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId: ctx.userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 200) },
    create: { userId: ctx.userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 200) },
  });
  // Uma notificação de boas-vindas na hora: é a prova de que funcionou.
  await sendPushToUser(ctx.userId, { title: "Avisos ligados", body: "É assim que eu te aviso quando algo pedir atenção.", url: "/mensal", tag: "welcome" });
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  await prisma.pushSubscription.deleteMany({ where: { userId: ctx.userId, endpoint } });
  return { ok: true };
}
