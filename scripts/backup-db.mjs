/**
 * Cópia de segurança do banco — roda todo dia, sozinho.
 *
 * O medo real da Dani é perder os dados de quem já pagou. Os deploys guardados na Vercel NÃO
 * são backup (são cópias do programa, não das informações) e o Git também não (guarda o código).
 * Quem guarda os dados é só isto aqui.
 *
 * Monta um JSON por tabela numa pasta temporária (fora do iCloud) e grava UM arquivo cifrado
 * por dia (`<data>.tar.gz.enc`, ver backup-cripto.mjs) em DOIS lugares:
 *  1. ~/Documents/spi-finance-backups  — no Mac;
 *  2. iCloud Drive                     — sai do Mac sozinho, sobrevive a perder/quebrar o Mac.
 * Desde 04/10/2026 nada sai em texto aberto: os dois lugares sobem pra nuvem (Documentos também
 * sincroniza com o iCloud) e o backup tem os dados financeiros de todos os clientes. A chave fica
 * só no Mac, em ~/.config/spi-finance/backup.key.
 *
 * Mantém os últimos 30 dias e apaga os mais velhos, senão a pasta cresce pra sempre.
 *
 * Rodar na mão:  npm run backup
 * Abrir um backup:  node --env-file=.env scripts/restore-db.mjs <arquivo .tar.gz.enc>
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { carregarChave, cifrarArquivo, decifrarArquivo } from "./backup-cripto.mjs";

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

const DIAS_GUARDADOS = 30;
const DESTINOS = [
  path.join(os.homedir(), "Documents", "spi-finance-backups"),
  path.join(os.homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs", "spi-finance-backups"),
];

// Datas/Decimal do Prisma não viram JSON sozinhos; BigInt também estoura o JSON.stringify.
// Bytes (o arquivo de importação guardado) vira base64: sem isso cada byte saía como `"123": 45`,
// o ImportFile passou de 450 MB e em 28/09/2026 o backup inteiro parou com "Invalid string length".
// O restore-db.mjs desfaz o { $bytes }.
function serializar(chave, valor) {
  const original = this?.[chave];
  if (original instanceof Uint8Array) return { $bytes: Buffer.from(original).toString("base64") };
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
    // A pasta aberta (antes de 04/10/2026) e o arquivo cifrado contam igual: os 30 mais novos ficam.
    .filter((n) => /^\d{4}-\d{2}-\d{2}_\d{4}(\.tar\.gz\.enc)?$/.test(n))
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

// Lê quem aponta ANTES de quem é apontado (lançamento antes de categoria, perfil antes de
// usuária). O backup não é um retrato único do banco, e na ordem do schema a categoria "Pet"
// criada no meio do backup ficava fora do CustomCategory.json mas o gasto nela entrava no
// MonthlyEntry.json: no restore, lançamento órfão. Lendo o filho primeiro, tudo que ele aponta
// já existia e ainda vai estar lá quando a tabela-mãe for lida.
{
  const modelos = Prisma.dmmf.datamodel.models;
  const pais = new Map(modelos.map((m) => [m.name, m.fields.filter((f) => f.kind === "object" && f.relationFromFields?.length && f.type !== m.name).map((f) => f.type)]));
  const paisPrimeiro = [];
  const visto = new Set();
  const visitar = (nome) => {
    if (visto.has(nome)) return;
    visto.add(nome);
    for (const pai of pais.get(nome) ?? []) visitar(pai);
    paisPrimeiro.push(nome);
  };
  modelos.forEach((m) => visitar(m.name));
  const posicao = (tabela) => {
    const i = paisPrimeiro.indexOf(tabela.charAt(0).toUpperCase() + tabela.slice(1));
    return i < 0 ? -1 : paisPrimeiro.length - i; // fora do schema: primeiro
  };
  tabelas.sort((a, b) => posicao(a) - posicao(b));
}

/**
 * Lê a tabela em pedaços. O Neon recusa resposta acima de 64 MB, e a tabela dos arquivos de
 * importação guardados (ImportFile) passou disso em 29/09/2026: o backup parava no meio, sem
 * aviso no diário, e as tabelas depois dela (lançamentos, orçamento, metas) ficavam de fora.
 * Tabela com `id` anda pelo id; ImportFile vai de poucos em poucos (cada arquivo tem até 4 MB).
 */
const TEM_ID = new Set(Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === "id" && f.isId)).map((m) => m.name));
async function* lerEmPartes(tabela, Nome) {
  if (!TEM_ID.has(Nome)) {
    yield* await prisma[tabela].findMany();
    return;
  }
  const tamanho = Nome === "ImportFile" ? 2 : 1000; // arquivos antigos têm até ~7,5 MB: 5 juntos passavam dos 64 MB de resposta do Neon
  let depoisDe;
  for (;;) {
    const lote = await prisma[tabela].findMany({
      take: tamanho,
      orderBy: { id: "asc" },
      ...(depoisDe ? { cursor: { id: depoisDe }, skip: 1 } : {}),
    });
    yield* lote;
    if (lote.length < tamanho) return;
    depoisDe = lote.at(-1).id;
  }
}

// A chave vem antes de ler o banco: sem chave não tem backup cifrado, e é melhor falhar já.
const chave = carregarChave({ criar: true });
const nome = carimbo();
const linhasPorTabela = {};

// Monta numa pasta temporária do sistema (fora de Documentos e do iCloud), uma linha do banco por
// vez: montar a tabela inteira numa string só estoura o limite do Node quando ela cresce (foi o
// que derrubou o backup em 28/09/2026). A pasta aberta é apagada no fim, dê certo ou não.
const trabalho = fs.mkdtempSync(path.join(os.tmpdir(), "spi-backup-"));
process.on("exit", () => fs.rmSync(trabalho, { recursive: true, force: true }));
const pastaLocal = path.join(trabalho, nome);
fs.mkdirSync(pastaLocal, { recursive: true });
for (const tabela of tabelas) {
  const Nome = tabela.charAt(0).toUpperCase() + tabela.slice(1);
  const fd = fs.openSync(path.join(pastaLocal, `${Nome}.json`), "w");
  fs.writeSync(fd, "[\n");
  let n = 0;
  try {
    for await (const linha of lerEmPartes(tabela, Nome)) {
      fs.writeSync(fd, (n ? ",\n" : "") + JSON.stringify(linha, serializar));
      n += 1;
    }
  } catch (e) {
    // O backup roda ANTES de aplicar uma migração (02/10/2026): o schema já conhece a tabela ou
    // a coluna nova, o banco ainda não. Tabela que não existe não tem o que copiar; coluna que
    // não existe faz o Prisma recusar a tabela inteira, então ela vem crua, com o que o banco tem.
    if (n > 0 || (e?.code !== "P2021" && e?.code !== "P2022")) throw e;
    if (e.code === "P2022") {
      for (const linha of await prisma.$queryRawUnsafe(`SELECT * FROM "${Nome}"`)) {
        fs.writeSync(fd, (n ? ",\n" : "") + JSON.stringify(linha, serializar));
        n += 1;
      }
    }
  }
  linhasPorTabela[Nome] = n;
  fs.writeSync(fd, "\n]\n");
  fs.closeSync(fd);
}

const total = Object.values(linhasPorTabela).reduce((a, b) => a + b, 0);
fs.writeFileSync(
  path.join(pastaLocal, "_resumo.json"),
  JSON.stringify({ geradoEm: new Date().toISOString(), totalDeLinhas: total, linhasPorTabela }, null, 2),
);

// Compacta, cifra e confere: o arquivo cifrado só vale se abrir de volta com a chave.
const compactado = path.join(trabalho, `${nome}.tar.gz`);
execFileSync("tar", ["-czf", compactado, "-C", trabalho, nome]);
const cifrado = path.join(trabalho, `${nome}.tar.gz.enc`);
await cifrarArquivo(compactado, cifrado, chave);
await decifrarArquivo(cifrado, path.join(trabalho, "conferencia.tar.gz"), chave);

// Primeiro no Mac, depois no iCloud: se ele estiver fora do ar, o backup no Mac já está feito.
for (const destino of DESTINOS) {
  try {
    fs.mkdirSync(destino, { recursive: true });
    const arquivo = path.join(destino, `${nome}.tar.gz.enc`);
    fs.copyFileSync(cifrado, arquivo);
    const apagadas = limparAntigos(destino);
    console.log(`OK  ${arquivo}  (${total} linhas${apagadas ? `, ${apagadas} backup(s) antigo(s) apagado(s)` : ""})`);
  } catch (erro) {
    console.error(`FALHOU  ${destino}:`, erro.message);
  }
}

await prisma.$disconnect();
console.log(`\n${tabelas.length} tabelas, ${total} linhas no total.`);

// Diário legível, pra ela conferir "rodou ontem?" sem abrir terminal. Quem escreve é o node,
// não o script de shell: no agendamento automático o macOS barra o bash dentro de Documentos.
try {
  const linha = `${new Date().toLocaleString("pt-BR")}  —  backup feito (cifrado): ${total} linhas, ${tabelas.length} tabelas\n`;
  fs.appendFileSync(path.join(DESTINOS[0], "_quando-rodou.txt"), linha);
} catch {
  // Log é conveniência; se falhar, o backup em si já está gravado e isso não pode derrubar nada.
}
