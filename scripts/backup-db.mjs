/**
 * Cópia de segurança do banco — roda todo dia, sozinho.
 *
 * O medo real da Dani é perder os dados de quem já pagou. Os deploys guardados na Vercel NÃO
 * são backup (são cópias do programa, não das informações) e o Git também não (guarda o código).
 * Quem guarda os dados é só isto aqui.
 *
 * Grava uma pasta por dia com um arquivo JSON por tabela, em DOIS lugares:
 *  1. ~/Documents/spi-finance-backups  — no Mac, pra abrir na hora;
 *  2. iCloud Drive                     — sai do Mac sozinho, sobrevive a perder/quebrar o Mac.
 *
 * Mantém os últimos 30 dias e apaga os mais velhos, senão a pasta cresce pra sempre.
 *
 * Rodar na mão:  npm run backup
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

const DIAS_GUARDADOS = 30;
const DESTINOS = [
  path.join(os.homedir(), "Documents", "spi-finance-backups"),
  path.join(os.homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs", "spi-finance-backups"),
];

// Datas/Decimal do Prisma não viram JSON sozinhos; BigInt também estoura o JSON.stringify.
function serializar(_chave, valor) {
  if (typeof valor === "bigint") return valor.toString();
  if (valor !== null && typeof valor === "object" && typeof valor.toFixed === "function") return valor.toString();
  return valor;
}

/** Carimbo do dia: uma pasta por dia, com hora, pra rodar duas vezes no mesmo dia não sobrescrever. */
function carimbo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Apaga as pastas além das N mais recentes. Só mexe no que tem cara de pasta de backup. */
function limparAntigos(destino) {
  if (!fs.existsSync(destino)) return 0;
  const pastas = fs
    .readdirSync(destino)
    .filter((n) => /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(n))
    .sort()
    .reverse();
  let apagadas = 0;
  for (const velha of pastas.slice(DIAS_GUARDADOS)) {
    fs.rmSync(path.join(destino, velha), { recursive: true, force: true });
    apagadas += 1;
  }
  return apagadas;
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

// As tabelas saem do próprio Prisma, não de uma lista escrita à mão: tabela nova entra no
// backup automaticamente, sem ninguém lembrar de vir aqui editar.
const tabelas = Object.keys(prisma).filter(
  (k) => !k.startsWith("_") && !k.startsWith("$") && typeof prisma[k]?.findMany === "function",
);

const nome = carimbo();
const linhasPorTabela = {};
const arquivos = [];

for (const tabela of tabelas) {
  const linhas = await prisma[tabela].findMany();
  const Nome = tabela.charAt(0).toUpperCase() + tabela.slice(1);
  linhasPorTabela[Nome] = linhas.length;
  arquivos.push([`${Nome}.json`, JSON.stringify(linhas, serializar, 2)]);
}

const total = Object.values(linhasPorTabela).reduce((a, b) => a + b, 0);
arquivos.push([
  "_resumo.json",
  JSON.stringify({ geradoEm: new Date().toISOString(), totalDeLinhas: total, linhasPorTabela }, null, 2),
]);

// Escreve num destino de cada vez: se o iCloud estiver fora do ar, o backup no Mac já está feito.
for (const destino of DESTINOS) {
  try {
    const pasta = path.join(destino, nome);
    fs.mkdirSync(pasta, { recursive: true });
    for (const [arquivo, conteudo] of arquivos) fs.writeFileSync(path.join(pasta, arquivo), conteudo);
    const apagadas = limparAntigos(destino);
    console.log(`OK  ${pasta}  (${total} linhas${apagadas ? `, ${apagadas} backup(s) antigo(s) apagado(s)` : ""})`);
  } catch (erro) {
    console.error(`FALHOU  ${destino}:`, erro.message);
  }
}

await prisma.$disconnect();
console.log(`\n${tabelas.length} tabelas, ${total} linhas no total.`);

// Diário legível, pra ela conferir "rodou ontem?" sem abrir terminal. Quem escreve é o node,
// não o script de shell: no agendamento automático o macOS barra o bash dentro de Documentos.
try {
  const linha = `${new Date().toLocaleString("pt-BR")}  —  backup feito: ${total} linhas, ${tabelas.length} tabelas\n`;
  fs.appendFileSync(path.join(DESTINOS[0], "_quando-rodou.txt"), linha);
} catch {
  // Log é conveniência; se falhar, o backup em si já está gravado e isso não pode derrubar nada.
}
