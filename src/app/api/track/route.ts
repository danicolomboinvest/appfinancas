import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { normalizeUsagePath } from "@/lib/usage/normalize-path";

/** Eventos aceitos hoje. Lista fechada: o cliente não inventa nome de evento. */
const ALLOWED_EVENTS = new Set(["pageview"]);

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
