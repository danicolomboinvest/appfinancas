import webpush from "web-push";
import { prisma } from "@/lib/db/prisma";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

function configured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;
function ensureVapid() {
  if (vapidReady || !configured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:suporte@spifinance.app",
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  vapidReady = true;
}

export function isPushConfigured(): boolean {
  return configured();
}

/**
 * Manda a notificação pra todos os aparelhos da pessoa. Inscrição morta (aparelho desinstalou,
 * permissão revogada: 404/410) é apagada na hora. Devolve quantos aparelhos receberam.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!configured()) return 0;
  ensureVapid();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let delivered = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
      delivered += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
      } else {
        console.error("push falhou:", sub.endpoint.slice(0, 40), err);
      }
    }
  }
  return delivered;
}
