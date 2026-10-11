import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
// Em funções serverless (Vercel), abrir WebSocket para cada escrita é frágil: a leitura
// funciona mas o INSERT/UPDATE derruba a função com 500. Roteando as queries do pool por
// HTTP (fetch), escrita e leitura usam o mesmo caminho confiável, sem depender de WebSocket.
neonConfig.poolQueryViaFetch = true;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Banco local (Postgres na própria máquina, só para desenvolver e tirar fotos das telas): o
 * adaptador da Neon fala HTTP com o servidor da Neon e não sabe conversar com um Postgres comum,
 * então aqui o Prisma usa o motor dele mesmo. Produção e preview continuam na Neon.
 */
function bancoLocal(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function createPrismaClient() {
  if (bancoLocal(process.env.DATABASE_URL)) return new PrismaClient();
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
