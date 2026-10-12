/**
 * Gera a base comunitária (src/lib/import/base-comunitaria.json) a partir do que as pessoas já
 * categorizaram no app. Ver src/lib/import/comunidade.ts para as regras de privacidade.
 *
 * Lê a produção SÓ PARA LEITURA (transação read-only; nada é gravado no banco) e escreve só o
 * arquivo, com comerciante, categoria, confiança e número de pessoas. Nenhum id, valor, data ou
 * e-mail sai do banco para o arquivo.
 *
 * Rodar (toda semana basta; depois é commit + deploy):
 *   BASE_URL_LEITURA="postgres://..." npx tsx scripts/base-comunitaria.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import type { ParentCategory } from "@prisma/client";
import { montarBaseComunitaria, type Voto } from "../src/lib/import/comunidade";

/** Conta de teste ou da equipe não vota. */
const CONTA_DE_TESTE = /(applereview|teste|test|demo|exemplo|@danicolombo\.com\.br|@fatoscapital\.com\.br)/i;

async function main() {
  const url = process.env.BASE_URL_LEITURA;
  if (!url) throw new Error("Defina BASE_URL_LEITURA com a URL do banco (só leitura).");
  const sql = neon(url);
  const [regras, lancamentos] = await sql.transaction(
    [
      // Regra = escolha da pessoa (na revisão ou corrigindo depois). Só categoria fixa.
      sql`select r."userId" as pessoa, coalesce(p.kind::text, 'PESSOAL') as kind, r.pattern as descricao,
                 r."parentCategory"::text as categoria, 1 as vezes, u.email
            from "TransactionCategoryRule" r
            join "User" u on u.id = r."userId"
            left join "FinancialProfile" p on p.id = r."profileId"
           where u.role = 'CLIENT'`,
      // Lançamento com categoria escolhida ou conferida pela pessoa: o importado passou pela
      // revisão; o escrito à mão foi ela. O do Open Finance não (o app categoriza sozinho, sem
      // ninguém conferir), e a personalizada não serve para os outros.
      sql`select e."userId" as pessoa, coalesce(p.kind::text, 'PESSOAL') as kind, e.description as descricao,
                 e."parentCategory"::text as categoria, count(*)::int as vezes, u.email
            from "MonthlyEntry" e
            join "User" u on u.id = e."userId"
            left join "FinancialProfile" p on p.id = e."profileId"
           where u.role = 'CLIENT' and e.category = 'EXPENSE' and e."parentCategory" is not null
             and e."customCategoryId" is null and e."externalId" is null and e.description is not null
           group by 1, 2, 3, 4, 6`,
    ],
    { readOnly: true },
  );
  const votos: Voto[] = [];
  for (const r of [...regras, ...lancamentos] as { pessoa: string; kind: string; descricao: string; categoria: string; vezes: number; email: string | null }[]) {
    if (r.email && CONTA_DE_TESTE.test(r.email)) continue;
    const perfil = r.kind === "EMPRESA" ? "empresa" : "pessoal";
    for (let i = 0; i < Math.min(r.vezes, 50); i += 1) votos.push({ pessoa: r.pessoa, perfil, descricao: r.descricao, categoria: r.categoria as ParentCategory });
  }
  const base = montarBaseComunitaria(votos);
  const destino = join(process.cwd(), "src/lib/import/base-comunitaria.json");
  writeFileSync(destino, `${JSON.stringify(base, null, 1)}\n`);
  const altas = (l: typeof base.pessoal) => l.filter((e) => e.confianca >= 0.7).length;
  console.log(`votos: ${votos.length}; pessoal: ${base.pessoal.length} comerciantes (${altas(base.pessoal)} com alta confiança); empresa: ${base.empresa.length} (${altas(base.empresa)})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
