/**
 * Restaura o banco a partir de uma pasta de backup (um JSON por tabela, ver backup-db.mjs).
 * Insere em ordem de dependência; tabela que falhar por chave estrangeira volta pra fila
 * até ninguém mais avançar. Linhas já existentes são puladas (skipDuplicates).
 *
 * Rodar:  node --env-file=.env scripts/restore-db.mjs "<pasta do backup>"
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "node:fs";
import path from "node:path";

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

const pasta = process.argv[2];
if (!pasta || !fs.existsSync(pasta)) {
  console.error("Uso: node --env-file=.env scripts/restore-db.mjs <pasta>");
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

const ORDEM = [
  "User", "AllowedEmail", "AllowedProduct", "ReferenceRate", "AnalysisCriterionDefinition",
  "CustomCategory", "Goal", "Asset", "AnalysisSheet", "AnalysisResponse", "Budget", "MonthlyPlan",
  "ImportBatch", "MonthlyEntry", "EmergencyFund", "PlanningParams", "PortfolioStrategy",
  "TransactionCategoryRule", "PatrimonySnapshot", "PasswordResetToken", "DividendEvent", "UsageEvent",
  "AdvisorClientLink", "Simulation", "AccumulationProjectionCache", "YearlyConsolidationCache",
  "NotificationLog", "PushSubscription", "BankConnection",
];
const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => f.replace(/\.json$/, ""));
const fila = [...ORDEM.filter((t) => arquivos.includes(t)), ...arquivos.filter((t) => !ORDEM.includes(t))];

const modelo = (Nome) => prisma[Nome.charAt(0).toLowerCase() + Nome.slice(1)];

async function inserir(Nome) {
  const linhas = JSON.parse(fs.readFileSync(path.join(pasta, `${Nome}.json`), "utf8"));
  const m = modelo(Nome);
  if (!m) return { ok: false, motivo: "modelo não existe mais" };
  let feitas = 0;
  for (let i = 0; i < linhas.length; i += 300) {
    const lote = linhas.slice(i, i + 300);
    try {
      const r = await m.createMany({ data: lote, skipDuplicates: true });
      feitas += r.count;
    } catch (e) {
      return { ok: false, motivo: String(e.message).split("\n").slice(-3).join(" ").slice(0, 300), feitas };
    }
  }
  return { ok: true, feitas, total: linhas.length };
}

let pendentes = fila;
for (let rodada = 1; rodada <= 6 && pendentes.length > 0; rodada += 1) {
  const proximas = [];
  for (const Nome of pendentes) {
    const r = await inserir(Nome);
    if (r.ok) console.log(`✓ ${Nome}: ${r.feitas}/${r.total}`);
    else {
      console.log(`… ${Nome}: adiada (${r.motivo})`);
      proximas.push(Nome);
    }
  }
  if (proximas.length === pendentes.length) break;
  pendentes = proximas;
}
if (pendentes.length) console.log("NÃO restauradas:", pendentes.join(", "));
await prisma.$disconnect();
