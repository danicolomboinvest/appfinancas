import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * O "Só meu" e a conta escondida NUNCA aparecem para o outro (Casal simples, regra 6).
 *
 * A promessa se sustenta em duas coisas, e as duas são cobradas aqui:
 * 1. Só a leitura de src/lib/casa/regras.ts sabe chegar no Pessoal do outro, e ela tira o "Só
 *    meu" e a conta escondida (ver regras.test.ts, num banco de mentira).
 * 2. Só as telas que a proposta junta (Resumo, Orçamento, Transações e o acerto) usam essa
 *    leitura. Todo o resto do app (busca do servidor, exportação, Dinheiro perdido, contas do
 *    histórico, Raio-X, e-mails, crons) continua filtrando por userId + profileId de quem está
 *    logado, e por isso nem enxerga o Pessoal do outro.
 *
 * Quem quiser levar a casa para uma tela nova acrescenta o arquivo aqui, de propósito.
 */

const PODEM_LER_A_CASA = [
  "lib/casa/regras.ts",
  "lib/repositories/casa.repo.ts",
  "lib/repositories/monthly-entry.repo.ts",
  "lib/repositories/budget.repo.ts",
  "lib/repositories/orcamento-detalhe.repo.ts",
  "lib/consolidation/monthly.ts",
  "lib/consolidation/seis-meses.ts",
  "app/(app)/mensal/foco/dados.ts",
  "app/(app)/mensal/foco/blocos.ts",
  // O Resumo novo (14/10/2026): os mesmos totais do Resumo de hoje, dos dois que eu enxergo.
  "app/(app)/mensal/foco/novo/dados.ts",
  "lib/auth/session.ts",
];

/** As leituras que nunca podem ver a casa, uma por uma, com o porquê. */
const NUNCA_LEEM_A_CASA = [
  "lib/repositories/dinheiro-perdido.repo.ts",
  "lib/repositories/contas-do-historico.repo.ts",
  "app/(app)/configuracoes/dados/actions.ts",
  "app/api/cron/monthly-recap/route.ts",
  "app/api/cron/alerts/route.ts",
  "lib/recap/monthly.ts",
  "lib/repositories/limpar-dados.repo.ts",
  "lib/repositories/mover-perfil.repo.ts",
  "lib/repositories/delete-account.repo.ts",
];

function arquivos(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === "__tests__" || nome === "node_modules") continue;
      arquivos(caminho, achados);
    } else if (/\.(ts|tsx)$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

const FILTROS_DA_CASA = /\b(lancamentosParaVer|lancamentosDosTotais|doOutroVisivel|lancamentosDoAcertoDaCasa|casaDoUsuario)\b/;

describe("o escondido nunca vaza para o outro", () => {
  const todos = arquivos("src");

  it("só as telas da proposta usam a leitura que junta os dois", () => {
    const usam = todos.filter((c) => FILTROS_DA_CASA.test(readFileSync(c, "utf-8"))).map((c) => c.replace(/^src\//, ""));
    const fora = usam.filter((c) => !PODEM_LER_A_CASA.includes(c));
    expect(fora, `Leem a casa sem estar na lista: ${fora.join(", ")}`).toEqual([]);
  });

  it("busca, exportação, Dinheiro perdido, contas do histórico, e-mails e limpeza não leem a casa", () => {
    for (const c of NUNCA_LEEM_A_CASA) {
      const texto = readFileSync(join("src", c), "utf-8");
      expect(FILTROS_DA_CASA.test(texto), c).toBe(false);
      expect(/\.casa\b/.test(texto), `${c} olha ctx.casa`).toBe(false);
    }
  });

  it("ninguém fora das regras monta filtro com o id do outro na mão", () => {
    const naMao = todos
      .filter((c) => !c.endsWith("lib/casa/regras.ts") && !c.endsWith("lib/repositories/casa.repo.ts"))
      .filter((c) => /outro\.(userId|profileId)/.test(readFileSync(c, "utf-8")));
    expect(naMao).toEqual([]);
  });

  it("toda leitura da casa por lançamento passa pelo comFiltro (o OR do mês não apaga a regra)", () => {
    for (const c of PODEM_LER_A_CASA.filter((x) => !x.startsWith("lib/casa/") && !x.endsWith("session.ts") && !x.endsWith("casa.repo.ts"))) {
      const texto = readFileSync(join("src", c), "utf-8");
      // Espalhar o filtro da casa num objeto com outro OR perderia um dos dois.
      expect(/\.\.\.(lancamentosParaVer|lancamentosDosTotais)\(/.test(texto), c).toBe(false);
    }
  });
});
