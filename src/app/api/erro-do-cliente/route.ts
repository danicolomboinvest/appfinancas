import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { normalizeUsagePath } from "@/lib/usage/normalize-path";
import { montarErroDoCliente } from "@/lib/erros/erro-do-cliente";

/**
 * Recebe os erros que acontecem no aparelho e grava no AppError, como os do servidor (ver
 * src/instrumentation.ts), com routeType "client" e a rota normalizada (sem ids nem datas).
 * Só com sessão, para ninguém de fora encher a tabela.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  let body: { onde?: unknown; mensagem?: unknown; rota?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const e = montarErroDoCliente(String(body.onde ?? ""), String(body.mensagem ?? ""), String(body.rota ?? "/"));
  const routePath = `${normalizeUsagePath(e.rota)} (aparelho: ${e.onde})`.slice(0, 200);
  try {
    await prisma.appError.upsert({
      where: { routePath_message: { routePath, message: e.mensagem } },
      create: { routePath, routeType: "client", method: "CLIENT", message: e.mensagem },
      update: { vezes: { increment: 1 }, ultimoEm: new Date() },
    });
  } catch {
    // melhor esforço
  }
  return NextResponse.json({ ok: true });
}
