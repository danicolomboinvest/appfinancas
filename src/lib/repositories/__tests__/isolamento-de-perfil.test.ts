import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  lancamentosDoAcerto,
  lancamentosQuePodeMexer,
  lancamentosVisiveis,
  metasDoCasal,
  donoDoNovoLancamento,
  type QuemOlha,
} from "@/lib/casal-login/privacidade";
import { decidirRotaDoPar } from "@/lib/casal-login/rotas-do-par";
import { SECOES_DO_PAR } from "@/lib/casal-login/menu-do-par";
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
  "yearlyConsolidationCache", "accumulationProjectionCache", "decisao", "contaAPagar", "divida", "fotoDaMeta",
  // Login do par (11/10/2026): o convite, o vínculo e o fechamento a dois vivem no perfil Casal.
  "conviteCasal", "membroCasal", "fechamentoCasal",
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
  { arquivo: "configuracoes/dados/actions.ts", motivo: "a exportação leva a conta inteira, com a coluna Perfil: a tela promete todos os lançamentos, e é o que se exporta antes de excluir a conta" },
  { arquivo: "api/metas/foto/[id]/route.ts", motivo: "a foto da meta é servida à dona em qualquer perfil dela; o perfil já foi conferido quando a meta guardou o link" },
  { arquivo: "pluggy/sync.ts", motivo: "a mesma transação do banco não pode existir em dois perfis, e o perfil de destino da conexão é deduzido do que ela já importou" },
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

/**
 * O SEGUNDO USUÁRIO (login do par, 11/10/2026).
 *
 * Até aqui um perfil tinha um dono só. Com o par, duas pessoas leem o mesmo perfil Casal, e a
 * promessa vira três: o par nunca lê o Pessoal nem a Empresa da titular; o "só meu" de um não
 * aparece para o outro (nem o total); e a renda da titular aparece para ele só como proporção.
 *
 * Os filtros de verdade (src/lib/casal-login/privacidade.ts) são aplicados aqui a um banco de
 * mentira com todos os tipos de linha, por um avaliador das mesmas formas de `where` do Prisma.
 */

type Linha = {
  id: string;
  userId: string;
  profileId: string;
  category: "INCOME" | "EXPENSE";
  pessoa: "A" | "B" | null;
  doCasal: boolean | null;
  soMeu: boolean;
  autorUserId: string | null;
};

/** Avalia um `where` do Prisma numa linha: igualdade, { not }, { in }, OR, AND e NOT. */
function bate(linha: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([chave, cond]) => {
    if (chave === "OR") return (cond as Record<string, unknown>[]).some((w) => bate(linha, w));
    if (chave === "AND") return (cond as Record<string, unknown>[]).every((w) => bate(linha, w));
    if (chave === "NOT") return !bate(linha, cond as Record<string, unknown>);
    const valor = linha[chave];
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond)) {
      const c = cond as { not?: unknown; in?: unknown[]; equals?: unknown };
      if ("not" in c) return valor !== c.not;
      if ("in" in c) return (c.in ?? []).includes(valor);
      if ("equals" in c) return valor === c.equals;
      throw new Error(`forma de where que o avaliador não conhece: ${chave}`);
    }
    return valor === cond;
  });
}

const ANA = "ana";
const LUCAS = "lucas";
const PESSOAL_ANA = "perfil-pessoal-ana";
const EMPRESA_ANA = "perfil-empresa-ana";
const CASAL = "perfil-casal-ana";
const PESSOAL_LUCAS = "perfil-pessoal-lucas";

const L = (id: string, o: Partial<Linha>): Linha => ({ id, userId: ANA, profileId: CASAL, category: "EXPENSE", pessoa: "A", doCasal: true, soMeu: false, autorUserId: null, ...o });

const BANCO: Linha[] = [
  L("pessoal-salario-ana", { profileId: PESSOAL_ANA, category: "INCOME", pessoa: null, doCasal: null }),
  L("pessoal-gasto-ana", { profileId: PESSOAL_ANA, pessoa: null, doCasal: null }),
  L("empresa-venda-ana", { profileId: EMPRESA_ANA, category: "INCOME", pessoa: null, doCasal: null }),
  L("casal-aluguel-nosso", {}),
  L("casal-mercado-nosso-do-lucas", { pessoa: "B", autorUserId: LUCAS }),
  L("casal-academia-da-ana", { doCasal: false }),
  L("casal-calca-so-meu-ana", { doCasal: false, soMeu: true }),
  L("casal-so-meu-lucas", { userId: LUCAS, pessoa: "B", doCasal: false, soMeu: true, autorUserId: LUCAS }),
  L("casal-renda-ana", { category: "INCOME", doCasal: null }),
  L("casal-renda-lucas", { category: "INCOME", pessoa: "B", doCasal: null, autorUserId: LUCAS }),
  L("casal-barbearia-do-lucas", { pessoa: "B", doCasal: false, autorUserId: LUCAS }),
  L("pessoal-do-lucas", { userId: LUCAS, profileId: PESSOAL_LUCAS, pessoa: null, doCasal: null }),
];

const PAR: QuemOlha = { userId: LUCAS, profileId: CASAL, donoId: ANA, par: { letra: "B", mostrarRenda: false } };
const TITULAR: QuemOlha = { userId: ANA, profileId: CASAL };

const ids = (where: Prisma.MonthlyEntryWhereInput) => BANCO.filter((l) => bate(l, where as Record<string, unknown>)).map((l) => l.id).sort();

describe("isolamento com o segundo usuário (login do par)", () => {
  it("o par vê o nosso, o de cada um e o só meu DELE; nada do Pessoal, da Empresa, do só meu nem da renda da titular", () => {
    expect(ids(lancamentosVisiveis(PAR))).toEqual(
      ["casal-aluguel-nosso", "casal-mercado-nosso-do-lucas", "casal-academia-da-ana", "casal-so-meu-lucas", "casal-renda-lucas", "casal-barbearia-do-lucas"].sort(),
    );
  });

  it("com 'mostrar minha renda' ligado, a renda da titular aparece para o par (e só ela muda)", () => {
    const comRenda = ids(lancamentosVisiveis({ ...PAR, par: { letra: "B", mostrarRenda: true } }));
    expect(comRenda.filter((x) => !ids(lancamentosVisiveis(PAR)).includes(x))).toEqual(["casal-renda-ana"]);
  });

  it("a titular vê tudo do Casal, inclusive o só meu dela, mas nunca o só meu do par", () => {
    const viu = ids(lancamentosVisiveis(TITULAR));
    expect(viu).toContain("casal-calca-so-meu-ana");
    expect(viu).not.toContain("casal-so-meu-lucas");
    expect(viu.every((id) => id.startsWith("casal-"))).toBe(true);
  });

  it("o acerto é o mesmo para os dois e não conta o só meu de ninguém", () => {
    expect(ids(lancamentosDoAcerto(PAR))).toEqual(ids(lancamentosDoAcerto(TITULAR)));
    expect(ids(lancamentosDoAcerto(PAR)).some((id) => id.includes("so-meu"))).toBe(false);
  });

  it("o par só mexe no que ele lançou; a titular mexe no Casal dela (e não no só meu dele)", () => {
    expect(ids(lancamentosQuePodeMexer(PAR))).toEqual(["casal-barbearia-do-lucas", "casal-mercado-nosso-do-lucas", "casal-renda-lucas", "casal-so-meu-lucas"]);
    expect(ids(lancamentosQuePodeMexer(TITULAR))).not.toContain("casal-so-meu-lucas");
  });

  it("todo filtro do par fica preso ao perfil Casal (nenhum caminho até outro perfil)", () => {
    for (const w of [lancamentosVisiveis(PAR), lancamentosDoAcerto(PAR), lancamentosQuePodeMexer(PAR), metasDoCasal(PAR)]) {
      expect((w as { profileId?: string }).profileId).toBe(CASAL);
    }
    for (const id of ids({ OR: [lancamentosVisiveis(PAR), lancamentosDoAcerto(PAR), lancamentosQuePodeMexer(PAR)] })) {
      expect(BANCO.find((l) => l.id === id)!.profileId).toBe(CASAL);
    }
  });

  it("as consultas antigas (userId + profileId da sessão) devolvem ao par só o que é dele: nada da titular", () => {
    // É o que protege as ~250 consultas que o app já tinha: o par entra com o userId DELE.
    expect(ids({ userId: PAR.userId, profileId: PAR.profileId })).toEqual(["casal-so-meu-lucas"]);
  });

  it("o nosso e o de cada um que o par lança ficam com a titular; o só meu fica com ele", () => {
    expect(donoDoNovoLancamento(PAR, false)).toBe(ANA);
    expect(donoDoNovoLancamento(PAR, true)).toBe(LUCAS);
    expect(donoDoNovoLancamento(TITULAR, true)).toBe(ANA);
  });

  it("as telas da titular respondem 404 para o par; só o Nós dois abre", () => {
    for (const rota of ["/carteira", "/carteira/estrategia", "/decidir", "/decidir/comprar", "/fichas/acoes", "/mensal/2026/10", "/orcamento/2026", "/perfis", "/planejamento/metas", "/configuracoes/dados", "/admin/acessos", "/parametros", "/viagem"]) {
      expect(decidirRotaDoPar(rota), rota).toBe("nao-existe");
    }
    for (const rota of ["/divisao", "/divisao/fechar", "/configuracoes/nos-dois", "/par/abc"]) expect(decidirRotaDoPar(rota), rota).toBe("segue");
    expect(decidirRotaDoPar("/")).toBe("casa");
    expect(decidirRotaDoPar("/mensal/foco")).toBe("casa");
    expect(SECOES_DO_PAR.map((s) => s.href)).toEqual(["/divisao", "/configuracoes/nos-dois"]);
  });

  it("toda leitura de lançamento do Nós dois passa por um filtro de privacidade", () => {
    const arquivos = ["src/lib/repositories/nos-dois.repo.ts", "src/lib/repositories/casal.repo.ts", "src/app/api/casal/lancamentos/route.ts"];
    const filtros = /lancamentosVisiveis|lancamentosDoAcerto|lancamentosQuePodeMexer|donoDoNovoLancamento|where,|where: \{ profileId: v\.profileId/;
    const soltas: string[] = [];
    for (const arquivo of arquivos) {
      const linhas = readFileSync(arquivo, "utf-8").split("\n");
      linhas.forEach((linha, i) => {
        if (!/prisma\.monthlyEntry\.(findMany|findFirst|count|aggregate|groupBy|updateMany|deleteMany|create)\(/.test(linha)) return;
        const trecho = linhas.slice(i, i + 4).join(" ");
        if (!filtros.test(trecho)) soltas.push(`${arquivo}:${i + 1}`);
      });
    }
    expect(soltas, `Leituras de lançamento sem filtro de privacidade:\n${soltas.join("\n")}`).toEqual([]);
  });
});

/** A sessão do par: o userId é sempre o DELE, nunca o da titular. */
describe("a sessão do par", () => {
  it("entra no perfil Casal com o próprio userId e a titular só como dona do perfil", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/auth.config", () => ({ auth: async () => ({ user: { id: LUCAS, role: "CLIENT", par: "em-uso" } }) }));
    vi.doMock("@/lib/repositories/casal-login.repo", () => ({
      perfilDoPar: async () => ({
        perfil: { id: CASAL, name: "Nós dois da Ana", kind: "CASAL", icon: "heart", theme: "girly", position: 0, isDefault: true, categorias: null, casal: null },
        par: { membroId: "m1", letra: "B", donoId: ANA, nomeTitular: "Ana", mostrarRenda: false, bloqueadoEm: null },
      }),
    }));
    vi.doMock("@/lib/repositories/profile.repo", () => ({
      getOrCreateActiveProfile: async () => {
        throw new Error("o par não pode ganhar perfil próprio aqui");
      },
    }));
    const { getRequiredSession } = await import("@/lib/auth/session");
    const ctx = await getRequiredSession();
    expect(ctx.userId).toBe(LUCAS);
    expect(ctx.profileId).toBe(CASAL);
    expect(ctx.donoId).toBe(ANA);
    expect(ctx.par?.letra).toBe("B");
    vi.doUnmock("@/lib/auth/auth.config");
    vi.doUnmock("@/lib/repositories/casal-login.repo");
    vi.doUnmock("@/lib/repositories/profile.repo");
  });
});
