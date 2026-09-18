import type { Instrumentation } from "next";

/**
 * Captura de erro de servidor, pra valer.
 *
 * O log da Vercel cobre só uns 45 minutos e o projeto não tem log drain: quando uma cliente
 * levava um erro de manhã, à tarde não existia mais como saber o que tinha sido. Aqui todo erro
 * de servidor (renderização, rota de API e server action) é gravado no banco, agrupado por
 * rota + mensagem, com contagem e primeira/última vez.
 *
 * O que NÃO entra: corpo da requisição, cookie, cabeçalho, query string e qualquer dado de
 * cliente. A rota guardada é o caminho do ARQUIVO ("/mensal/[year]/[month]"), não a URL real.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    // O Prisma é carregado aqui dentro de propósito: no runtime edge ele não existe, e um
    // import no topo derrubaria o instrumentation inteiro — inclusive pro runtime Node.
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    const { prisma } = await import("@/lib/db/prisma");

    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest).slice(0, 120) : null;
    const stack = err instanceof Error && err.stack ? err.stack.split("\n").slice(0, 12).join("\n").slice(0, 2000) : null;
    const routePath = (context.routePath || request.path || "desconhecida").slice(0, 200);

    await prisma.appError.upsert({
      where: { routePath_message: { routePath, message } },
      create: { routePath, routeType: context.routeType, method: request.method, message, digest, stack },
      update: { vezes: { increment: 1 }, ultimoEm: new Date(), digest, stack },
    });
  } catch {
    // Telemetria nunca pode virar o erro seguinte: se falhar, morre em silêncio.
  }
};
