import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

const erros = await prisma.appError.findMany({ where: { ultimoEm: { gte: new Date(Date.now() - 14*86400000) } }, orderBy: { vezes: "desc" }, select: { routePath:true, routeType:true, method:true, message:true, vezes:true, primeiroEm:true, ultimoEm:true } });
console.log("== ERROS DE SERVIDOR (14 dias):", erros.length);
for (const e of erros) console.log(JSON.stringify({ rota:e.routePath, tipo:e.routeType, vezes:e.vezes, de:e.primeiroEm.toISOString().slice(0,16), ate:e.ultimoEm.toISOString().slice(0,16), msg:e.message.slice(0,140) }));

const d7 = new Date(Date.now() - 7*86400000);
const d30 = new Date(Date.now() - 30*86400000);
const total = await prisma.user.count();
const ativos7 = await prisma.user.count({ where: { lastSeenAt: { gte: d7 } } });
const ativos30 = await prisma.user.count({ where: { lastSeenAt: { gte: d30 } } });
const novos7 = await prisma.user.count({ where: { createdAt: { gte: d7 } } });
console.log("== CONTAS:", { total, ativos7, ativos30, novos7 });

const comLancamento = await prisma.monthlyEntry.groupBy({ by: ["userId"], _count: { _all: true } });
console.log("nunca lançou nada:", total - comLancamento.length, "| já lançou:", comLancamento.length);

const tentaram = await prisma.importDiagnostic.groupBy({ by: ["userId"], _count: { _all: true } });
const sucesso = await prisma.importDiagnostic.groupBy({ by: ["userId"], where: { ok: true, stage: "confirm" }, _count: { _all: true } });
const idsSucesso = new Set(sucesso.map((s) => s.userId));
const semSucesso = tentaram.filter((t) => !idsSucesso.has(t.userId));
console.log("tentaram importar (sempre):", tentaram.length, "| nunca gravaram nada:", semSucesso.length);

const d1 = new Date(Date.now() - 7*86400000);
const t7 = await prisma.importDiagnostic.groupBy({ by: ["userId"], where: { createdAt: { gte: d1 } }, _count: { _all: true } });
const s7 = await prisma.importDiagnostic.groupBy({ by: ["userId"], where: { createdAt: { gte: d1 }, ok: true, stage: "confirm" }, _count: { _all: true } });
const ids7 = new Set(s7.map((s) => s.userId));
console.log("7 dias — tentaram importar:", t7.length, "| não conseguiram gravar:", t7.filter((t) => !ids7.has(t.userId)).length);

const falhas7 = await prisma.importDiagnostic.count({ where: { createdAt: { gte: d1 }, ok: false } });
const tot7 = await prisma.importDiagnostic.count({ where: { createdAt: { gte: d1 } } });
console.log("7 dias — tentativas:", tot7, "| falhas:", falhas7);
await prisma.$disconnect();
