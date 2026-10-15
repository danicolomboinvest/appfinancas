/**
 * Prepara o banco da jornada (e2e/jornada): apaga e recria o banco local `spi_jornada_teste`,
 * aplica as migrations e semeia as contas de teste. Assim toda rodada começa igual.
 *
 * Só roda contra o Postgres local (porta 54329). Nunca contra produção.
 */
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { BANCO, INICIO_DA_SEMEADURA, URL_DO_BANCO, URL_ADMIN } from "./config";
import { ARQUIVO_DO_RELOGIO, fecharBanco, marcarDia } from "./relogio";

const host = new URL(URL_DO_BANCO).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Recusei: a jornada só roda no banco local (veio "${host}").`);
  process.exit(1);
}

async function comTentativas<T>(f: () => Promise<T>): Promise<T> {
  // O Postgres local às vezes fica lotado ("too many clients"): espera e tenta de novo.
  for (let i = 0; ; i++) {
    try {
      return await f();
    } catch (e) {
      if (i < 20 && /too many clients/i.test(String(e))) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  const t0 = Date.now();
  await comTentativas(async () => {
    const c = new PrismaClient({ datasourceUrl: URL_ADMIN });
    try {
      await c.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${BANCO} WITH (FORCE)`);
      await c.$executeRawUnsafe(`CREATE DATABASE ${BANCO}`);
    } finally {
      await c.$disconnect();
    }
  });
  const env = { ...process.env, DATABASE_URL: URL_DO_BANCO };
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
  // Os gatilhos do relógio do banco (relogio-do-banco.sql) e o dia em que as contas nasceram.
  execFileSync("npx", ["prisma", "db", "execute", "--url", URL_DO_BANCO, "--file", "e2e/jornada/relogio-do-banco.sql"], { env, stdio: "pipe" });
  await marcarDia(INICIO_DA_SEMEADURA);
  const comRelogio = { ...env, SPI_RELOGIO_DE_TESTE: ARQUIVO_DO_RELOGIO, NODE_OPTIONS: `--require ${path.join(__dirname, "relogio-de-teste.cjs")}` };
  execFileSync("npx", ["tsx", "e2e/jornada/semear.ts"], { env: comRelogio, stdio: "inherit" });
  await fecharBanco();
  console.log(`Banco ${BANCO} pronto em ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
