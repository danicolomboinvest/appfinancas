import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { normalizeUsagePath } from "@/lib/usage/normalize-path";

/**
 * Eventos aceitos. Lista fechada de propósito: o cliente não inventa nome de evento, senão o
 * relatório vira um saco de strings e ninguém confia no que está lendo.
 *
 * Os nomeados existem pra medir o que o banco não revela depois. Um gasto digitado e um gasto
 * ditado terminam idênticos na tabela — sem marcar na hora, não dá pra saber se o áudio serve
 * pra alguém.
 */
const ALLOWED_EVENTS = new Set(["pageview", "registro_voz", "registro_digitado", "registro_importacao"]);

/**
 * Recebe os eventos de uso do próprio app (rastreio primeiro, sem script de terceiro).
 * Melhor esforço por natureza: resposta minúscula, erro nunca vira problema pra quem navega —
 * perder um evento é irrelevante, atrapalhar a navegação não.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    // Sem sessão não há o que medir (e nada de aceitar userId vindo do corpo).
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  // Admin navegando (você!) poluiria a estatística das clientas.
  if (session.user.role === "ADMIN") {
    return NextResponse.json({ ok: true, skipped: "admin" });
  }

  let body: { name?: unknown; path?: unknown; standalone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const rawPath = typeof body.path === "string" ? body.path : "";
  if (!ALLOWED_EVENTS.has(name) || !rawPath.startsWith("/")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await prisma.usageEvent.create({
      data: {
        userId: session.user.id,
        name,
        path: normalizeUsagePath(rawPath),
        standalone: body.standalone === true,
      },
    });
  } catch {
    // Banco piscou? Segue o baile — rastreio nunca pode derrubar nada.
  }
  return NextResponse.json({ ok: true });
}
