/**
 * Carga inicial das séries do Banco Central que o rendimento da renda fixa usa (tabela
 * SerieIndice, 15/10/2026): o CDI de cada dia útil (SGS 12) e o IPCA de cada mês (SGS 433),
 * desde a compra mais antiga entre todas as rendas fixas e Tesouros do app, ou 10 anos atrás, o
 * que vier antes. Depois disso o cron de indicadores traz só os dias novos.
 *
 * Busca na API pública do BC em janelas de 5 anos (a SGS recusa mais de 10 por consulta) e grava
 * só o que falta (rodar de novo não duplica). Não apaga nada.
 *
 * Rodar (depois de aplicar a migration 20261015180000_rendimento_renda_fixa):
 *   node --env-file="$HOME/Projects/SPI Finance/.env" node_modules/.bin/tsx scripts/carregar-series-indices.ts --ensaio
 *   node --env-file="$HOME/Projects/SPI Finance/.env" node_modules/.bin/tsx scripts/carregar-series-indices.ts --banco-de-producao-confirmado
 * Opções:
 *   --ensaio                        busca e conta, não grava nada;
 *   --desde=2014-01-01              começa nesta data (em vez da compra mais antiga / 10 anos);
 *   --recalcular                    depois da carga, recalcula o rendimento de todos (o mesmo do cron);
 *   --banco-de-producao-confirmado  exigido quando o banco não é local.
 */
import { prisma } from "@/lib/db/prisma";
import { buscarSeriePorPeriodo, gravarSerie, type NomeDaSerie } from "@/lib/indicadores/series";
import { ONDE_RENDA_FIXA, recalcularRendaFixaDeTodos } from "@/lib/portfolio/atualizar-renda-fixa";

const args = process.argv.slice(2);
const ensaio = args.includes("--ensaio");
const recalcular = args.includes("--recalcular");
const desdeArg = args.find((a) => a.startsWith("--desde="))?.slice(8);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL (use node --env-file).");
  const host = new URL(url).hostname;
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  console.log(`Banco: ${host}${local ? " (local)" : ""}${ensaio ? " · ensaio, nada é gravado" : ""}`);
  if (!local && !ensaio && !args.includes("--banco-de-producao-confirmado")) {
    throw new Error("Banco que não é local: rode primeiro com --ensaio e depois com --banco-de-producao-confirmado.");
  }

  const hoje = new Date();
  const dezAnos = new Date(Date.UTC(hoje.getUTCFullYear() - 10, hoje.getUTCMonth(), 1));
  let desde = dezAnos;
  if (desdeArg) {
    desde = new Date(`${desdeArg}T00:00:00Z`);
    if (Number.isNaN(desde.getTime())) throw new Error(`--desde inválido: ${desdeArg}`);
  } else {
    const maisAntigo = await prisma.asset.findFirst({ where: { ...ONDE_RENDA_FIXA, acquisitionDate: { not: null } }, orderBy: { acquisitionDate: "asc" }, select: { acquisitionDate: true } });
    const compra = maisAntigo?.acquisitionDate;
    if (compra && compra.getTime() < desde.getTime()) desde = new Date(Date.UTC(compra.getUTCFullYear(), compra.getUTCMonth(), 1));
    console.log(`Compra mais antiga: ${compra ? compra.toISOString().slice(0, 10) : "nenhuma com data"}`);
  }
  console.log(`Desde ${desde.toISOString().slice(0, 10)} até ${hoje.toISOString().slice(0, 10)}`);

  for (const serie of ["cdi", "ipca"] as NomeDaSerie[]) {
    const t0 = Date.now();
    const pontos = await buscarSeriePorPeriodo(serie, desde, hoje);
    const primeiro = pontos[0]?.data.toISOString().slice(0, 10) ?? "-";
    const ultimo = pontos[pontos.length - 1]?.data.toISOString().slice(0, 10) ?? "-";
    const gravados = ensaio ? 0 : await gravarSerie(serie, pontos);
    console.log(`${serie}: ${pontos.length} pontos (${primeiro} a ${ultimo}), ${ensaio ? "não gravou (ensaio)" : `${gravados} novos ou corrigidos`} em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }

  if (recalcular && !ensaio) {
    const r = await recalcularRendaFixaDeTodos({ prazo: Date.now() + 10 * 60_000, paralelo: 2 });
    console.log(`Rendimento: ${r.ativos} ativos, ${r.mudaram} mudaram de valor, ${r.semCalculo} sem cálculo, ${r.perfis} perfis com foto nova.`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
