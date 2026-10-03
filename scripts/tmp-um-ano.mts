/**
 * Acesso de compra do Hubla = 1 ano a partir da compra (02/10/2026). Simula por padrão;
 * grava só com --aplicar. Não toca em VIP, nas contas manuais da Dani nem em prazo >= 2035.
 */
import { PrismaClient } from "@prisma/client";
import { addAccessPeriod } from "../src/lib/repositories/allowedEmail.repo";

const p = new PrismaClient();
const aplicar = process.argv.includes("--aplicar");
const LIMITE_AMIGAS = new Date("2035-01-01T00:00:00Z");
const TOLERANCIA = 2 * 864e5;

const linhas = await p.allowedEmail.findMany({ select: { id: true, email: true, source: true, note: true, createdAt: true, expiresAt: true } });
const porEmail = new Map(linhas.map((l) => [l.email, l]));
const mudar: { id: string; de: Date; para: Date }[] = [];
let semCompraAchada = 0;
for (const l of linhas) {
  if (!l.expiresAt || l.expiresAt >= LIMITE_AMIGAS) continue;
  if ((l.note ?? "").startsWith("Convite VIP")) continue;
  let compra: Date;
  if (l.source === "HUBLA") compra = l.createdAt;
  else if ((l.note ?? "").startsWith("Hubla:")) {
    const outro = (l.note ?? "").match(/comprou com ([\w.+-]+@[\w.-]+\w)/)?.[1]?.toLowerCase();
    const linhaDaCompra = outro ? porEmail.get(outro) : undefined;
    if (!linhaDaCompra) semCompraAchada++;
    compra = linhaDaCompra?.createdAt ?? l.createdAt;
  } else continue;
  const certo = addAccessPeriod(compra);
  if (l.expiresAt.getTime() > certo.getTime() + TOLERANCIA) mudar.push({ id: l.id, de: l.expiresAt, para: certo });
}

const resumo: Record<string, number> = {};
for (const m of mudar) {
  const k = `${m.de.toISOString().slice(0, 7)} -> ${m.para.toISOString().slice(0, 7)}`;
  resumo[k] = (resumo[k] ?? 0) + 1;
}
console.log(Object.entries(resumo).sort().map(([k, v]) => `${v}\t${k}`).join("\n"));
console.log(`Total: ${mudar.length} liberações voltam pra 1 ano. Manual sem a compra achada: ${semCompraAchada}.`);
console.log(`Já vencidas pela regra nova: ${mudar.filter((m) => m.para < new Date()).length}`);

if (aplicar) {
  for (const m of mudar) await p.allowedEmail.update({ where: { id: m.id }, data: { expiresAt: m.para } });
  console.log("Aplicado.");
} else console.log("(simulação: nada gravado; rode com --aplicar)");
await p.$disconnect();
