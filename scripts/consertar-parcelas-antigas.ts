/**
 * Conserta as parcelas antigas das clientes (13/10/2026): projeta as parcelas que a importação
 * antiga não projetou e dá o dia às que ficaram "Sem data". A regra está em
 * src/lib/import/parcelas-antigas.ts (as mesmas funções da importação nova).
 *
 * Modos:
 *   npx tsx --env-file=<.env> scripts/consertar-parcelas-antigas.ts
 *       ENSAIO (o padrão): só lê, dentro de uma transação READ ONLY. Imprime os totais e grava o
 *       relatório (sem nome, e-mail ou CPF) em RELATORIO.
 *   ... --aplicar [--banco-de-producao-confirmado]
 *       Grava, em lotes (cada lote uma transação). Fora do banco local, recusa sem a confirmação.
 *       O registro do que foi feito vai para REGISTROS/parcelas-antigas-aplicado-<data>.json,
 *       atualizado a cada lote confirmado.
 *   ... --incluir-as-que-ja-eram-lidas
 *       Projeta também as compras que a importação antiga já lia (ver parcelas-antigas.ts).
 *   ... --desfazer <registro.json> [--banco-de-producao-confirmado]
 *       Apaga exatamente o que o registro diz que foi criado e volta a nulo o dia que foi posto
 *       (só onde ainda é o mesmo dia).
 *
 * A URL do banco vem de DATABASE_URL e nunca é impressa (só o host).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Prisma, PrismaClient } from "@prisma/client";
import ws from "ws";
import {
  aplicarPlano,
  desfazerConserto,
  MOTIVOS,
  planejarConserto,
  type BancoDoConserto,
  type LancamentoAntigo,
  type MotivoPulada,
  type OperacoesDoConserto,
  type Plano,
  type RegistroDoConserto,
} from "@/lib/import/parcelas-antigas";

const PASTA = "/Users/danielacolombo/Claude/estudo-apps-financas";
const RELATORIO = join(PASTA, "parcelas-antigas-ensaio.json");

function hostDoBanco(url: string): string {
  return new URL(url).hostname;
}

function ehLocal(url: string): boolean {
  const h = hostDoBanco(url);
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function novoCliente(url: string): PrismaClient {
  if (ehLocal(url)) return new PrismaClient({ datasourceUrl: url });
  // WebSocket (não o modo HTTP do app): a transação interativa precisa de uma conexão de verdade.
  neonConfig.webSocketConstructor = ws;
  neonConfig.poolQueryViaFetch = false;
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
}

type Linha = {
  id: string;
  userId: string;
  profileId: string | null;
  perfilTipo: string | null;
  year: number;
  month: number;
  category: LancamentoAntigo["category"];
  parentCategory: LancamentoAntigo["parentCategory"];
  customCategoryId: string | null;
  subcategory: string | null;
  description: string | null;
  descricaoDoBanco: string | null;
  amount: string;
  entryDate: string | null;
  importBatchId: string | null;
  loteTipo: string | null;
  loteAberto: boolean | null;
  pessoa: string | null;
  doCasal: boolean | null;
  soMeu: boolean;
  autorUserId: string | null;
  noCartao: boolean | null;
  divididoCom: string | null;
  recurrenceId: string | null;
  externalId: string | null;
};

/**
 * Colunas que podem ainda não existir no banco (migração mais nova que ele): entram como nulas.
 * O ensaio nunca roda migração; o conserto só precisa delas pra copiar o que a parcela tem.
 */
const OPCIONAIS: Record<string, { tabela: string; coluna: string; vazio: string }> = {
  loteAberto: { tabela: "ImportBatch", coluna: "faturaAberta", vazio: "false" },
  pessoa: { tabela: "MonthlyEntry", coluna: "pessoa", vazio: "NULL::text" },
  doCasal: { tabela: "MonthlyEntry", coluna: "doCasal", vazio: "NULL::boolean" },
  soMeu: { tabela: "MonthlyEntry", coluna: "soMeu", vazio: "false" },
  autorUserId: { tabela: "MonthlyEntry", coluna: "autorUserId", vazio: "NULL::text" },
  noCartao: { tabela: "MonthlyEntry", coluna: "noCartao", vazio: "NULL::boolean" },
  divididoCom: { tabela: "MonthlyEntry", coluna: "divididoCom", vazio: "NULL::text" },
};

async function colunasQueExistem(tx: Prisma.TransactionClient): Promise<Set<string>> {
  const r = await tx.$queryRawUnsafe<{ t: string; c: string }[]>(
    `SELECT table_name::text AS t, column_name::text AS c FROM information_schema.columns WHERE table_schema = current_schema() AND table_name IN ('MonthlyEntry', 'ImportBatch')`,
  );
  return new Set(r.map((x) => `${x.t}.${x.c}`));
}

/** Todo gasto com "N/T" ou "N de T" na descrição (ou no nome do banco, se ela renomeou). */
function consulta(existem: Set<string>): string {
  const col = (campo: string) => {
    const o = OPCIONAIS[campo];
    const alias = o.tabela === "ImportBatch" ? "b" : "e";
    return existem.has(`${o.tabela}.${o.coluna}`) ? `${alias}."${o.coluna}" AS "${campo}"` : `${o.vazio} AS "${campo}"`;
  };
  return `
  WITH renomeadas AS (
    SELECT DISTINCT ON (chave) chave, descricao FROM "Decisao"
    WHERE tipo = 'descricao_original' AND chave IS NOT NULL AND descricao IS NOT NULL
    ORDER BY chave, "createdAt" DESC
  )
  SELECT e.id, e."userId", e."profileId", p.kind::text AS "perfilTipo", e.year, e.month,
         e.category::text AS category, e."parentCategory"::text AS "parentCategory", e."customCategoryId",
         e.subcategory, e.description, r.descricao AS "descricaoDoBanco", e.amount::text AS amount,
         to_char(e."entryDate", 'YYYY-MM-DD') AS "entryDate", e."importBatchId",
         b."docType" AS "loteTipo", ${Object.keys(OPCIONAIS).map(col).join(", ")},
         e."recurrenceId", e."externalId"
  FROM "MonthlyEntry" e
  LEFT JOIN "FinancialProfile" p ON p.id = e."profileId"
  LEFT JOIN "ImportBatch" b ON b.id = e."importBatchId"
  LEFT JOIN renomeadas r ON r.chave = e.id
  WHERE e.amount > 0
    AND (e.description ~* '\\d{1,2}\\s*(/|de)\\s*\\d{1,2}' OR r.descricao ~* '\\d{1,2}\\s*(/|de)\\s*\\d{1,2}')
`;
}

async function lerLancamentos(tx: Prisma.TransactionClient): Promise<{ lancamentos: LancamentoAntigo[]; faltam: string[] }> {
  const existem = await colunasQueExistem(tx);
  const faltam = Object.values(OPCIONAIS).filter((o) => !existem.has(`${o.tabela}.${o.coluna}`)).map((o) => `${o.tabela}.${o.coluna}`);
  const linhas = await tx.$queryRawUnsafe<Linha[]>(consulta(existem));
  return { lancamentos: linhas.map((l) => ({ ...l, amount: Number(l.amount), loteAberto: l.loteAberto === true, soMeu: l.soMeu === true })), faltam };
}

// ---------------------------------------------------------------------------------------------
// Relatório (sem dado pessoal: descrição de loja, valor, meses e ids internos)

const mesTexto = (m: { year: number; month: number }) => `${String(m.month).padStart(2, "0")}/${m.year}`;

function relatorio(plano: Plano, host: string) {
  const afetadas = plano.compras.filter((c) => c.criar.length > 0 || c.darDia.length > 0);
  const perfis = (lista: typeof plano.compras) => new Set(lista.map((c) => `${c.userId}|${c.profileId ?? ""}`)).size;
  const comCriacao = plano.compras.filter((c) => c.criar.length > 0);
  const comDia = plano.compras.filter((c) => c.darDia.length > 0);
  const puladas: Record<string, { compras: number; descricao: string }> = {};
  for (const c of plano.compras) {
    if (!c.pulada) continue;
    puladas[c.pulada] ??= { compras: 0, descricao: MOTIVOS[c.pulada as MotivoPulada] };
    puladas[c.pulada].compras += 1;
  }
  const porTipo: Record<string, { compras: number; criar: number; dia: number }> = {};
  for (const c of afetadas) {
    const t = c.perfilTipo ?? "sem perfil";
    porTipo[t] ??= { compras: 0, criar: 0, dia: 0 };
    porTipo[t].compras += 1;
    porTipo[t].criar += c.criar.length;
    porTipo[t].dia += c.darDia.length;
  }
  // Exemplos variados: as que mais criam, de perfis diferentes.
  const vistos = new Set<string>();
  const exemplos = [...afetadas]
    .sort((a, b) => b.criar.length - a.criar.length || b.darDia.length - a.darDia.length)
    .filter((c) => {
      const k = `${c.userId}|${c.profileId}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .slice(0, 10)
    .map((c) => ({
      perfilId: c.profileId,
      perfilTipo: c.perfilTipo,
      loja: c.nome,
      valorDaParcela: c.valor,
      total: c.total,
      conhecidas: c.conhecidas.map((k) => `${k.n}/${c.total} em ${mesTexto(k.mes)}${k.dia ? ` (dia ${k.dia.slice(8)})` : " (sem dia)"}`),
      criaria: c.criar.map((p) => `${p.description} em ${mesTexto(p)}${p.entryDate ? ` dia ${p.entryDate.slice(8)}` : " sem dia"}${p.parentCategory || p.customCategoryId ? "" : " (sem categoria)"}`),
      ganhamDia: c.darDia.length,
    }));
  const anos = new Map<number, number>();
  for (const c of comCriacao) for (const p of c.criar) anos.set(p.year, (anos.get(p.year) ?? 0) + 1);
  return {
    geradoEm: new Date().toISOString(),
    modo: "ENSAIO (somente leitura)",
    banco: host,
    lancamentosComParcela: plano.lancamentosComParcela,
    ambiguasComCaraDeData: plano.ambiguas,
    comprasLidas: plano.compras.length,
    // A maior N conhecida da compra é menor que o total: ainda falta parcela no app.
    comprasComParcelaFaltando: (() => {
      const inc = plano.compras.filter((c) => Math.max(...c.conhecidas.map((k) => k.n)) < c.total);
      return {
        total: inc.length,
        perfis: perfis(inc),
        projetam: inc.filter((c) => c.criar.length > 0).length,
        puladas: inc.filter((c) => c.pulada).length,
        jaEstaoNoAppSemParenteses: inc.filter((c) => !c.pulada && c.criar.length === 0).length,
      };
    })(),
    comprasCompletas: plano.compras.filter((c) => Math.max(...c.conhecidas.map((k) => k.n)) >= c.total).length,
    comprasAfetadas: afetadas.length,
    perfisAfetados: perfis(afetadas),
    projecao: {
      compras: comCriacao.length,
      perfis: perfis(comCriacao),
      parcelasACriar: comCriacao.reduce((s, c) => s + c.criar.length, 0),
      semCategoriaPorSerLojaDeTudo: comCriacao.reduce((s, c) => s + c.criar.filter((p) => p.category === "EXPENSE" && !p.parentCategory && !p.customCategoryId).length, 0),
      porAnoDaParcela: Object.fromEntries([...anos].sort((a, b) => a[0] - b[0])),
    },
    dia: {
      compras: comDia.length,
      perfis: perfis(comDia),
      parcelasQueGanhamDia: comDia.reduce((s, c) => s + c.darDia.length, 0),
      continuamSemDia: plano.compras.reduce((s, c) => s + c.semDiaConhecido, 0),
      continuamSemDiaExplicacao: "nenhuma parcela da mesma compra tem dia; a importação nova também não inventa dia quando a linha não traz data",
    },
    porTipoDePerfil: porTipo,
    puladas,
    exemplos,
  };
}

// ---------------------------------------------------------------------------------------------
// Banco de verdade

function bancoPrisma(prisma: PrismaClient): BancoDoConserto {
  return {
    transacao: (fn) =>
      prisma.$transaction(
        async (tx) => {
          const ops: OperacoesDoConserto = {
            async criar(itens) {
              if (itens.length === 0) return [];
              const r = await tx.monthlyEntry.createManyAndReturn({
                data: itens.map((i) => ({ ...i, amount: new Prisma.Decimal(i.amount.toFixed(2)), entryDate: i.entryDate ? new Date(`${i.entryDate}T00:00:00Z`) : null })),
                select: { id: true },
              });
              if (r.length !== itens.length) throw new Error("criou um número diferente do pedido");
              return r.map((x) => x.id);
            },
            async darDia(itens) {
              const feitos: string[] = [];
              for (const i of itens) {
                const r = await tx.monthlyEntry.updateMany({ where: { id: i.id, userId: i.userId, entryDate: null }, data: { entryDate: new Date(`${i.dia}T00:00:00Z`) } });
                if (r.count > 0) feitos.push(i.id);
              }
              return feitos;
            },
            async apagar(itens) {
              let n = 0;
              for (let k = 0; k < itens.length; k += 500) {
                const parte = itens.slice(k, k + 500);
                const r = await tx.monthlyEntry.deleteMany({ where: { OR: parte.map((i) => ({ id: i.id, userId: i.userId })) } });
                n += r.count;
              }
              return n;
            },
            async tirarDia(itens) {
              let n = 0;
              for (const i of itens) {
                const r = await tx.monthlyEntry.updateMany({ where: { id: i.id, userId: i.userId, entryDate: new Date(`${i.dia}T00:00:00Z`) }, data: { entryDate: null } });
                n += r.count;
              }
              return n;
            },
          };
          return fn(ops);
        },
        { timeout: 120_000, maxWait: 20_000 },
      ),
  };
}

function gravar(caminho: string, dados: unknown) {
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definido");
  const host = hostDoBanco(url);
  const confirmado = args.includes("--banco-de-producao-confirmado");
  const aplicar = args.includes("--aplicar");
  const iDesfazer = args.indexOf("--desfazer");
  const escreve = aplicar || iDesfazer !== -1;
  if (escreve && !ehLocal(url) && !confirmado) {
    console.error(`Recusado: ${host} não é o banco local. Para gravar fora dele, passe --banco-de-producao-confirmado.`);
    process.exit(2);
  }
  const prisma = novoCliente(url);
  try {
    if (iDesfazer !== -1) {
      const arquivo = args[iDesfazer + 1];
      if (!arquivo) throw new Error("--desfazer precisa do arquivo de registro");
      const registro = JSON.parse(readFileSync(arquivo, "utf8")) as RegistroDoConserto;
      if (registro.banco !== host) throw new Error(`O registro é do banco ${registro.banco}, não de ${host}.`);
      const r = await desfazerConserto(registro, bancoPrisma(prisma));
      console.log(`Desfeito em ${host}: ${r.apagados} parcelas criadas apagadas, ${r.semDia} voltaram a ficar sem dia.`);
      return;
    }

    // Leitura: no ensaio, dentro de uma transação READ ONLY (o banco recusa qualquer escrita).
    const { lancamentos, faltam } = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        return lerLancamentos(tx);
      },
      { timeout: 120_000, maxWait: 20_000 },
    );
    const plano = planejarConserto(lancamentos, { incluirJaLidas: args.includes("--incluir-as-que-ja-eram-lidas") });
    const rel = { ...relatorio(plano, host), colunasQueAindaNaoExistemNoBanco: faltam };
    if (aplicar && faltam.some((c) => c.startsWith("MonthlyEntry."))) throw new Error(`Recusado: o banco ainda não tem ${faltam.join(", ")} (migração pendente). Aplique só depois do deploy.`);

    if (!aplicar) {
      gravar(RELATORIO, rel);
      console.log(JSON.stringify({ ...rel, exemplos: `${rel.exemplos.length} no arquivo` }, null, 2));
      console.log(`\nENSAIO: nada foi gravado no banco. Relatório em ${RELATORIO}`);
      return;
    }

    const inicio = new Date().toISOString();
    const caminho = join(PASTA, `parcelas-antigas-aplicado-${inicio.replace(/[:.]/g, "-")}.json`);
    const registro: RegistroDoConserto = { versao: 1, banco: host, inicio, lotes: [] };
    gravar(caminho, registro);
    const r = await aplicarPlano(plano, bancoPrisma(prisma), registro, (reg) => gravar(caminho, reg));
    console.log(`Aplicado em ${host}: ${r.criados} parcelas criadas, ${r.comDia} ganharam dia. Registro para desfazer: ${caminho}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
