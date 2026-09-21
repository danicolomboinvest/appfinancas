import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
const d7 = new Date(Date.now() - 7*86400000);

const tent = await prisma.importDiagnostic.groupBy({ by: ["userId"], where: { createdAt: { gte: d7 } }, _count: { _all: true } });
const suc = await prisma.importDiagnostic.groupBy({ by: ["userId"], where: { createdAt: { gte: d7 }, ok: true, stage: "confirm" }, _count: { _all: true } });
const ok = new Set(suc.map(s=>s.userId));
const presos = tent.filter(t=>!ok.has(t.userId)).map(t=>t.userId);
const users = await prisma.user.findMany({ where: { id: { in: presos } }, select: { id:true, name:true, email:true, lastSeenAt:true, createdAt:true } });
console.log("== QUEM TENTOU E NÃO GRAVOU NADA (7 dias)");
for (const u of users) {
  const ds = await prisma.importDiagnostic.findMany({ where: { userId: u.id, createdAt: { gte: d7 } }, orderBy: { createdAt: "desc" }, select: { createdAt:true, target:true, ok:true, encoding:true, institution:true, fileName:true, moneyLines:true, parsed:true, message:true } });
  console.log("-", u.name, "|", u.email, "| entrou por último:", u.lastSeenAt?.toISOString().slice(0,16), "| tentativas:", ds.length);
  for (const d of ds.slice(0,4)) console.log("    ", d.createdAt.toISOString().slice(5,16), d.target, d.encoding, d.institution ?? "-", "linhas:", d.moneyLines, "lidas:", d.parsed, "|", (d.message??"").slice(0,110));
}

console.log("\n== FALHAS POR FORMATO (7 dias)");
const falhas = await prisma.importDiagnostic.findMany({ where: { createdAt: { gte: d7 }, ok: false }, select: { userId:true, encoding:true, institution:true, header:true, message:true } });
const por = new Map();
for (const f of falhas) {
  const k = `${f.encoding} · ${f.institution ?? "banco não reconhecido"} · ${(f.message??"").slice(0,70)}`;
  const e = por.get(k) ?? { vezes:0, pessoas:new Set(), header:f.header };
  e.vezes++; e.pessoas.add(f.userId); por.set(k, e);
}
[...por.entries()].sort((a,b)=>b[1].pessoas.size-a[1].pessoas.size).forEach(([k,v])=>console.log(`${v.pessoas.size} pessoa(s) · ${v.vezes}x · ${k}`));

console.log("\n== CONTAS NOVAS (7 dias) QUE NÃO LANÇARAM NADA");
const novos = await prisma.user.findMany({ where: { createdAt: { gte: d7 } }, select: { id:true, createdAt:true, lastSeenAt:true } });
const comE = new Set((await prisma.monthlyEntry.groupBy({ by:["userId"] })).map(x=>x.userId));
console.log("novos:", novos.length, "| sem nenhum lançamento:", novos.filter(n=>!comE.has(n.id)).length, "| nunca voltaram depois do 1º dia:", novos.filter(n=>!n.lastSeenAt || n.lastSeenAt.getTime()-n.createdAt.getTime() < 3600000).length);
await prisma.$disconnect();
