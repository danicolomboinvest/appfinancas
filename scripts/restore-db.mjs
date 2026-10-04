/**
 * Restaura o banco a partir de uma pasta de backup (um JSON por tabela, ver backup-db.mjs).
 * Insere em ordem de dependência; linha que falhar (ex.: chave estrangeira) volta pra fila
 * até ninguém mais avançar. Linhas já existentes são puladas (skipDuplicates).
 *
 * Rodar:  node --env-file=.env scripts/restore-db.mjs "<pasta do backup ou arquivo .tar.gz.enc>"
 *
 * Desde 04/10/2026 o backup é um arquivo cifrado (ver backup-cripto.mjs): ele é aberto com a
 * chave do Mac numa pasta temporária, que some no fim. As pastas abertas antigas continuam valendo.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { execFileSync } from "node:child_process";
import { carregarChave, decifrarArquivo } from "./backup-cripto.mjs";

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

let pasta = process.argv[2];
if (!pasta || !fs.existsSync(pasta)) {
  console.error("Uso: node --env-file=.env scripts/restore-db.mjs <pasta ou arquivo .tar.gz.enc>");
  process.exit(1);
}
if (pasta.endsWith(".tar.gz.enc")) {
  const trabalho = fs.mkdtempSync(path.join(os.tmpdir(), "spi-restore-"));
  process.on("exit", () => fs.rmSync(trabalho, { recursive: true, force: true }));
  const compactado = path.join(trabalho, "backup.tar.gz");
  await decifrarArquivo(pasta, compactado, carregarChave());
  execFileSync("tar", ["-xzf", compactado, "-C", trabalho]);
  const dentro = fs.readdirSync(trabalho).filter((n) => fs.statSync(path.join(trabalho, n)).isDirectory());
  if (dentro.length !== 1) throw new Error("O backup cifrado não tem a pasta esperada dentro.");
  pasta = path.join(trabalho, dentro[0]);
}
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

/**
 * Ordem de dependência tirada do próprio schema (quem aponta pra quem), não de uma lista à mão:
 * a lista antiga não tinha FinancialProfile nem ImportFile, que caíam no fim em ordem alfabética,
 * e todo lançamento esperava uma rodada inteira pelo perfil. Tabela nova entra sozinha.
 */
function ordemDasTabelas() {
  const modelos = Prisma.dmmf.datamodel.models;
  const dependeDe = new Map(
    modelos.map((m) => [
      m.name,
      m.fields.filter((f) => f.kind === "object" && f.relationFromFields?.length && f.type !== m.name).map((f) => f.type),
    ]),
  );
  const ordem = [];
  const visto = new Set();
  const visitar = (nome) => {
    if (visto.has(nome)) return;
    visto.add(nome); // marca antes de descer: um ciclo, se um dia existir, não trava aqui
    for (const pai of dependeDe.get(nome) ?? []) visitar(pai);
    ordem.push(nome);
  };
  for (const m of modelos) visitar(m.name);
  return ordem;
}

const ORDEM = ordemDasTabelas();
const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => f.replace(/\.json$/, ""));
const fila = [...ORDEM.filter((t) => arquivos.includes(t)), ...arquivos.filter((t) => !ORDEM.includes(t))];

const modelo = (Nome) => prisma[Nome.charAt(0).toLowerCase() + Nome.slice(1)];

// { $bytes } é como o backup guarda campos Bytes (o arquivo de importação): volta a ser Buffer.
const reviver = (_k, v) => (v && typeof v === "object" && typeof v.$bytes === "string" ? Buffer.from(v.$bytes, "base64") : v);

/**
 * Lê o JSON da tabela. O backup grava uma linha do banco por linha do arquivo, então lê linha a
 * linha: o ImportFile inteiro numa string só passa do limite de tamanho de string do Node quando
 * cresce (foi o que derrubou o backup em 28/09/2026). Arquivo em outro formato cai no JSON.parse.
 */
async function lerTabela(Nome) {
  const arquivo = path.join(pasta, `${Nome}.json`);
  const linhas = [];
  const leitor = readline.createInterface({ input: fs.createReadStream(arquivo, "utf8"), crlfDelay: Infinity });
  try {
    for await (const bruta of leitor) {
      const t = bruta.trim();
      if (!t || t === "[" || t === "]") continue;
      linhas.push(JSON.parse(t.endsWith(",") ? t.slice(0, -1) : t, reviver));
    }
    return linhas;
  } catch {
    leitor.close();
    return JSON.parse(fs.readFileSync(arquivo, "utf8"), reviver);
  }
}

// Cada arquivo guardado tem até 4–6 MB e o Neon recusa pedido acima de 64 MB (em hex o Bytes
// dobra de tamanho): o ImportFile vai de um em um. O resto vai de 300 em 300.
const tamanhoDoLote = (Nome) => (Nome === "ImportFile" ? 1 : 300);
const motivoDe = (e) => String(e?.message ?? e).split("\n").slice(-3).join(" ").slice(0, 300);

/**
 * Tenta gravar as linhas pendentes de uma tabela e devolve as que ficaram de fora, com o motivo.
 * Antes, o primeiro lote que falhava abandonava a tabela inteira, e a rodada seguinte caía no
 * mesmo lote: um lançamento apontando pra uma categoria criada durante o backup (que não está
 * no CustomCategory.json) deixava de fora os até 299 lançamentos mais recentes. Agora o lote que
 * falha é refeito linha a linha, e só a linha ruim fica de fora.
 */
async function inserir(Nome, pendentes) {
  const m = modelo(Nome);
  if (!m) return { feitas: 0, falhas: pendentes.map((linha) => ({ linha, motivo: "modelo não existe mais" })) };
  const tamanho = tamanhoDoLote(Nome);
  let feitas = 0;
  const falhas = [];
  for (let i = 0; i < pendentes.length; i += tamanho) {
    const lote = pendentes.slice(i, i + tamanho);
    try {
      feitas += (await m.createMany({ data: lote, skipDuplicates: true })).count;
      continue;
    } catch (e) {
      if (lote.length === 1) {
        falhas.push({ linha: lote[0], motivo: motivoDe(e) });
        continue;
      }
    }
    for (const linha of lote) {
      try {
        feitas += (await m.createMany({ data: [linha], skipDuplicates: true })).count;
      } catch (e) {
        falhas.push({ linha, motivo: motivoDe(e) });
      }
    }
  }
  return { feitas, falhas };
}

// Rodadas: cada uma tenta de novo só as linhas que ficaram de fora (a dona delas pode ter
// entrado depois, noutra tabela). Para quando uma rodada inteira não grava nenhuma linha.
const pendentesPorTabela = new Map();
const totalPorTabela = new Map();
for (const Nome of fila) {
  const linhas = await lerTabela(Nome);
  pendentesPorTabela.set(Nome, linhas);
  totalPorTabela.set(Nome, linhas.length);
}
const ultimaFalha = new Map();
for (let rodada = 1; rodada <= 6; rodada += 1) {
  let avancou = false;
  for (const Nome of fila) {
    const pendentes = pendentesPorTabela.get(Nome);
    if (!pendentes.length) continue;
    const { feitas, falhas } = await inserir(Nome, pendentes);
    const gravadas = pendentes.length - falhas.length;
    if (gravadas > 0) avancou = true;
    pendentesPorTabela.set(Nome, falhas.map((f) => f.linha));
    ultimaFalha.set(Nome, falhas);
    if (!falhas.length) console.log(`✓ ${Nome}: ${totalPorTabela.get(Nome)} linhas (${feitas} novas)`);
    else console.log(`… ${Nome}: ${falhas.length} linha(s) adiada(s) (${falhas[0].motivo})`);
  }
  if (!avancou || [...pendentesPorTabela.values()].every((p) => !p.length)) break;
}

// Relatório final: só o que ficou de fora, linha por linha, com o motivo.
const naoRestauradas = [...pendentesPorTabela.entries()].filter(([, p]) => p.length);
if (naoRestauradas.length) {
  const relatorio = {};
  console.log("\nNÃO restauradas:");
  for (const [Nome, pendentes] of naoRestauradas) {
    const falhas = ultimaFalha.get(Nome) ?? [];
    relatorio[Nome] = falhas.map((f) => ({ id: f.linha?.id ?? null, motivo: f.motivo }));
    console.log(`  ${Nome}: ${pendentes.length} de ${totalPorTabela.get(Nome)} linha(s)`);
    for (const f of relatorio[Nome].slice(0, 20)) console.log(`    ${f.id ?? "(sem id)"}  ${f.motivo}`);
    if (relatorio[Nome].length > 20) console.log(`    … e mais ${relatorio[Nome].length - 20}`);
  }
  const arquivoRelatorio = path.join(os.tmpdir(), `restore-nao-restauradas-${Date.now()}.json`);
  fs.writeFileSync(arquivoRelatorio, JSON.stringify(relatorio, null, 2));
  console.log(`\nLista completa (ids e motivos): ${arquivoRelatorio}`);
} else {
  console.log("\nTudo restaurado.");
}
await prisma.$disconnect();
