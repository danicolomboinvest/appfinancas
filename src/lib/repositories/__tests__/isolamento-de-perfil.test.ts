import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Nenhuma consulta a dado de dinheiro pode filtrar só por usuário.
 *
 * Este é o teste que sustenta a promessa central dos perfis: uma receita lançada na Empresa não
 * pode aparecer no Pessoal. São 129 pontos de acesso espalhados por 30 arquivos, e um esquecido
 * não quebra nada visível — apenas mostra o dinheiro de um perfil dentro de outro, calado.
 *
 * É o mesmo remédio que o `delete-account-cobertura.test.ts` usa: em vez de confiar que alguém
 * vai lembrar, a máquina relê o código e cobra. Quem criar uma consulta nova numa tabela com
 * escopo e esquecer o perfil descobre aqui, não em produção.
 */

/** Tabelas que vivem DENTRO de um perfil. Precisa bater com o schema e com o backfill. */
const COM_ESCOPO = [
  "monthlyEntry", "budget", "monthlyPlan", "customCategory", "goal", "asset", "emergencyFund",
  "planningParams", "portfolioStrategy", "patrimonySnapshot", "importBatch",
  "contributionAllocation", "transactionCategoryRule", "simulation", "analysisSheet",
  "yearlyConsolidationCache", "accumulationProjectionCache",
];

/**
 * Consultas que filtram por usuário de propósito, sem perfil, com o motivo.
 *
 * Toda entrada aqui é uma decisão consciente — e é por isso que a lista tem motivo escrito:
 * uma exceção sem justificativa é indistinguível de um esquecimento.
 */
const EXCECOES: { arquivo: string; motivo: string }[] = [
  { arquivo: "delete-account.repo.ts", motivo: "excluir a conta apaga TUDO da pessoa, em todos os perfis" },
  { arquivo: "profile.repo.ts", motivo: "é o repositório dos próprios perfis" },
  { arquivo: "admin-analytics.repo.ts", motivo: "relatório da plataforma conta a base inteira" },
  { arquivo: "community-results.repo.ts", motivo: "resultados agregados somam todos os perfis" },
  { arquivo: "adoption-funnel.repo.ts", motivo: "funil mede contas, não perfis" },
];

function arquivosDoProjeto(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === "__tests__" || nome === "node_modules") continue;
      arquivosDoProjeto(caminho, achados);
    } else if (nome.endsWith(".ts") || nome.endsWith(".tsx")) {
      achados.push(caminho);
    }
  }
  return achados;
}

/** Acha o modelo do Prisma a que uma linha pertence, olhando pra trás no arquivo. */
function modeloDaLinha(linhas: string[], i: number): string | null {
  for (let j = i; j >= Math.max(0, i - 8); j--) {
    const m = linhas[j].match(/prisma\.(\w+)\./);
    if (m) return m[1];
  }
  return null;
}

describe("isolamento entre perfis", () => {
  it("nenhuma consulta a dado de dinheiro filtra só por usuário", () => {
    const faltando: string[] = [];

    for (const caminho of arquivosDoProjeto("src")) {
      if (EXCECOES.some((e) => caminho.endsWith(e.arquivo))) continue;
      const linhas = readFileSync(caminho, "utf-8").split("\n");

      linhas.forEach((linha, i) => {
        if (!/userId:\s*ctx\.userId/.test(linha)) return;
        if (linha.includes("profileId")) return;
        const modelo = modeloDaLinha(linhas, i);
        if (modelo && COM_ESCOPO.includes(modelo)) {
          faltando.push(`${caminho}:${i + 1} → prisma.${modelo} sem profileId`);
        }
      });
    }

    expect(faltando, `Consultas sem isolamento de perfil:\n${faltando.join("\n")}`).toEqual([]);
  });

  it("a lista de tabelas com escopo bate com o schema", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf-8");
    // Todo modelo que declara profileId precisa estar na lista — senão o teste acima ignora ele.
    // Fatiado por bloco de modelo, e não por regex atravessando o arquivo: uma regex preguiçosa
    // passa do fechamento de um modelo e acusa tabela que nem tem a coluna.
    const comColuna = schema
      .split(/\nmodel /)
      .slice(1)
      .map((bloco) => ({ nome: bloco.split(/\s/)[0], corpo: bloco.split("\n}")[0] }))
      .filter((m) => /^\s*profileId\s+String/m.test(m.corpo))
      .map((m) => m.nome);
    const naLista = new Set(COM_ESCOPO.map((n) => n[0].toUpperCase() + n.slice(1)));
    const esquecidos = comColuna.filter((m) => m !== "FinancialProfile" && !naLista.has(m));
    expect(esquecidos, `Tabelas com profileId fora da lista: ${esquecidos.join(", ")}`).toEqual([]);
  });

  it("toda exceção tem motivo escrito", () => {
    for (const e of EXCECOES) expect(e.motivo.length, e.arquivo).toBeGreaterThan(20);
  });
});
