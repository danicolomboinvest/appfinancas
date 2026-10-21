/**
 * Corrige os lançamentos antigos de 99 Food (Transporte → Alimentação/Delivery) e Cacau Show
 * (Lazer → Alimentação/Lanche/Café) que o app categorizou errado sozinho (21/10/2026). A regra
 * está em src/lib/import/correcao-de-categorias.ts.
 *
 * Modos:
 *   npx tsx --env-file=<.env> scripts/corrigir-categorias-99food-cacau.ts
 *       ENSAIO (o padrão): só lê, dentro de uma transação READ ONLY. Imprime os totais (sem nome,
 *       e-mail ou valor de ninguém) e não grava nada.
 *   ... --aplicar [--banco-de-producao-confirmado]
 *       Grava numa transação só. Fora do banco local, recusa sem a confirmação. O registro (ids e a
 *       categoria de antes) vai para PASTA/categorias-99food-cacau-aplicado-<data>.json.
 *   ... --desfazer <registro.json> [--banco-de-producao-confirmado]
 *       Volta a categoria de antes, só onde o lançamento ainda está com a categoria que a
 *       correção pôs (se ela mudou depois, fica como ela deixou).
 *
 * A URL do banco vem de DATABASE_URL e nunca é impressa (só o host).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";
import { CORRECOES, planejarCorrecao, type Mudanca } from "@/lib/import/correcao-de-categorias";

const PASTA = "/Users/danielacolombo/Claude/estudo-apps-financas";

type Registro = { versao: 1; banco: string; inicio: string; mudancas: Mudanca[] };

function hostDoBanco(url: string): string {
  return new URL(url).hostname;
}

function ehLocal(url: string): boolean {
  const h = hostDoBanco(url);
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function novoCliente(url: string): PrismaClient {
  if (ehLocal(url)) return new PrismaClient({ datasourceUrl: url });
  neonConfig.webSocketConstructor = ws;
  neonConfig.poolQueryViaFetch = false;
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
}

function gravar(caminho: string, dados: unknown) {
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`);
}

/** Só as lojas e as categorias erradas das correções: o resto do banco nem é lido. */
async function ler(tx: Pick<PrismaClient, "monthlyEntry" | "transactionCategoryRule">) {
  const lancamentos = await tx.monthlyEntry.findMany({
    where: {
      category: "EXPENSE",
      // Peneira larga no banco ("food", "cacau"); a regra exata (planejarCorrecao) decide.
      OR: [
        { parentCategory: "TRANSPORTE", description: { contains: "food", mode: "insensitive" } },
        { parentCategory: "LAZER", description: { contains: "cacau", mode: "insensitive" } },
      ],
    },
    select: { id: true, userId: true, description: true, parentCategory: true, subcategory: true, customCategoryId: true, importBatchId: true, year: true, month: true },
  });
  const regras = await tx.transactionCategoryRule.findMany({
    where: { OR: [{ pattern: { contains: "99", mode: "insensitive" } }, { pattern: { contains: "cacau", mode: "insensitive" } }] },
    select: { userId: true, pattern: true, parentCategory: true },
  });
  return { lancamentos, regras };
}

async function main() {
  const args = process.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definido");
  const host = hostDoBanco(url);
  const confirmado = args.includes("--banco-de-producao-confirmado");
  const aplicar = args.includes("--aplicar");
  const iDesfazer = args.indexOf("--desfazer");
  if ((aplicar || iDesfazer !== -1) && !ehLocal(url) && !confirmado) {
    console.error(`Recusado: ${host} não é o banco local. Para gravar fora dele, passe --banco-de-producao-confirmado.`);
    process.exit(2);
  }
  const prisma = novoCliente(url);
  try {
    if (iDesfazer !== -1) {
      const arquivo = args[iDesfazer + 1];
      if (!arquivo) throw new Error("--desfazer precisa do arquivo de registro");
      const registro = JSON.parse(readFileSync(arquivo, "utf8")) as Registro;
      if (registro.banco !== host) throw new Error(`O registro é do banco ${registro.banco}, não de ${host}.`);
      const voltou = await prisma.$transaction(async (tx) => {
        let n = 0;
        for (const m of registro.mudancas) {
          const r = await tx.monthlyEntry.updateMany({
            where: { id: m.id, parentCategory: m.para.parentCategory, subcategory: m.para.subcategory },
            data: { parentCategory: m.de.parentCategory, subcategory: m.de.subcategory },
          });
          n += r.count;
        }
        return n;
      }, { timeout: 120_000, maxWait: 20_000 });
      console.log(`Desfeito em ${host}: ${voltou} de ${registro.mudancas.length} voltaram à categoria de antes.`);
      return;
    }

    const { lancamentos, regras } = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        return ler(tx);
      },
      { timeout: 120_000, maxWait: 20_000 },
    );
    const { mudancas, pulados } = planejarCorrecao(lancamentos, regras);
    const porId = new Map(lancamentos.map((l) => [l.id, l]));
    const resumo = CORRECOES.map((c) => {
      const delas = mudancas.filter((m) => m.correcao === c.nome);
      const meses = new Set(delas.map((m) => `${porId.get(m.id)!.year}-${String(porId.get(m.id)!.month).padStart(2, "0")}`));
      return { loja: c.nome, de: c.errada, para: `${c.certa.parentCategory} / ${c.certa.subcategory}`, lancamentos: delas.length, contas: new Set(delas.map((m) => porId.get(m.id)!.userId)).size, meses: [...meses].sort() };
    });
    console.log(JSON.stringify({ banco: host, resumo, pulados }, null, 2));

    if (!aplicar) {
      console.log("\nENSAIO: nada foi gravado no banco.");
      return;
    }

    const inicio = new Date().toISOString();
    const caminho = join(PASTA, `categorias-99food-cacau-aplicado-${inicio.replace(/[:.]/g, "-")}.json`);
    const registro: Registro = { versao: 1, banco: host, inicio, mudancas };
    gravar(caminho, registro);
    const feitas = await prisma.$transaction(async (tx) => {
      let n = 0;
      for (const m of mudancas) {
        // Só se ainda está como o app deixou: se ela mudou entre o ensaio e agora, vale o dela.
        const r = await tx.monthlyEntry.updateMany({
          where: { id: m.id, parentCategory: m.de.parentCategory, customCategoryId: null },
          data: { parentCategory: m.para.parentCategory, subcategory: m.para.subcategory },
        });
        n += r.count;
      }
      return n;
    }, { timeout: 300_000, maxWait: 20_000 });
    console.log(`Aplicado em ${host}: ${feitas} de ${mudancas.length} lançamentos corrigidos. Registro para desfazer: ${caminho}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
