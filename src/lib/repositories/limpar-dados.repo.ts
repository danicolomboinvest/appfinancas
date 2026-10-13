import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import {
  DECISOES_QUE_FICAM,
  EVENTO_DADOS_LIMPOS,
  LIMITE_DE_LIMPEZAS,
  PREFIXO_DO_MONEY_RESET,
  casalParaRecomecar,
  comecoParaRecomecar,
  conexoesDosPerfis,
  contagensZeradas,
  type ContagensDaLimpeza,
  type EscopoDaLimpeza,
} from "@/lib/limpar-dados/regras";

/**
 * "Limpar meus dados e recomeçar": apaga o DINHEIRO do perfil e mantém a conta.
 *
 * Fica: a conta (User, senha, sessões), assinatura e compras (AllowedEmail, AllowedProduct,
 * ProdutoLiberado, Apple), os pedidos antes de cancelar e os motivos, aparência, idioma, moeda e
 * avisos, a foto e o nome, o próprio perfil (nome, tipo, ícone, tema), o vínculo do Nós dois
 * (convite e par), o widget, os aparelhos com notificação, as taxas que ela editou e os registros
 * do app (uso, erros, avisos enviados).
 *
 * Sai, só de quem pediu (userId) e só dos perfis limpos (profileId): ver a lista em
 * ContagensDaLimpeza. Tudo numa transação só: ou limpa tudo, ou nada.
 *
 * No Nós dois, o "só meu" do par é gravado com o userId DELE (ver casal-login/privacidade.ts),
 * então o filtro userId + profileId nunca alcança o par. Quando quem limpa é o par, sai só o que
 * é dele dentro do Casal, e o combinado do casal fica com a titular.
 */

export type OpcoesDaLimpeza = { escopo: EscopoDaLimpeza; zerarMoneyReset: boolean };

export type ResultadoDaLimpeza = {
  contagens: ContagensDaLimpeza;
  perfis: number;
  /** Itens da Pluggy das conexões removidas aqui: a revogação lá fora fica para quem chama. */
  itensPluggy: string[];
};

/** Cabe mais uma limpeza agora? (no máximo LIMITE_DE_LIMPEZAS.maximo por hora, por conta) */
export async function cabeMaisUmaLimpeza(userId: string, agora = new Date()): Promise<boolean> {
  const desde = new Date(agora.getTime() - LIMITE_DE_LIMPEZAS.janelaMs);
  const feitas = await prisma.usageEvent.count({ where: { userId, name: EVENTO_DADOS_LIMPOS, createdAt: { gte: desde } } });
  return feitas < LIMITE_DE_LIMPEZAS.maximo;
}

export async function limparDados(ctx: AuthContext, opcoes: OpcoesDaLimpeza): Promise<ResultadoDaLimpeza> {
  const userId = ctx.userId;
  const ehPar = Boolean(ctx.par && ctx.donoId && ctx.donoId !== userId);

  // Os perfis da própria pessoa (dona). O perfil ativo do par é o Casal da titular: entra no
  // escopo para apagar o lado dele, mas nunca nas mudanças do próprio perfil.
  const meus = await prisma.financialProfile.findMany({ where: { userId }, select: { id: true, kind: true, casal: true } });
  const alvo = opcoes.escopo === "todos" ? [...new Set([...meus.map((p) => p.id), ctx.profileId])] : [ctx.profileId];
  const meusNoAlvo = meus.filter((p) => alvo.includes(p.id));
  const casaisDaDona = meusNoAlvo.filter((p) => p.kind === "CASAL").map((p) => p.id);

  // "Todos" também leva o histórico de antes dos perfis (profileId nulo), que é da conta toda.
  const onde = opcoes.escopo === "todos" ? { userId, OR: [{ profileId: { in: alvo } }, { profileId: null }] } : { userId, profileId: { in: alvo } };

  // Bancos conectados que só alimentam os perfis limpos (ver conexoesDosPerfis).
  const conexoes = await prisma.bankConnection.findMany({ where: { userId }, select: { id: true, itemId: true, connectorName: true } });
  const idsDasConexoes =
    opcoes.escopo === "todos"
      ? conexoes.map((c) => c.id)
      : conexoes.length === 0
        ? []
        : conexoesDosPerfis(
            conexoes,
            await prisma.importBatch.findMany({ where: { userId, docType: "openfinance" }, select: { profileId: true, fileName: true } }),
            new Set(alvo),
          );

  const ficam: Prisma.DecisaoWhereInput[] = [{ tipo: { in: [...DECISOES_QUE_FICAM] } }];
  if (!opcoes.zerarMoneyReset) ficam.push({ tipo: { startsWith: PREFIXO_DO_MONEY_RESET } });

  const usuario = ehPar ? null : await prisma.user.findUnique({ where: { id: userId }, select: { comeco: true } });

  // A ordem respeita as chaves estrangeiras sem cascata: lançamentos e ativos antes de metas e
  // categorias, aportes antes de tudo. Cada passo diz em que contagem ele soma.
  const apagar: [keyof ContagensDaLimpeza, Prisma.PrismaPromise<Prisma.BatchPayload>][] = [
    ["aportesEmAtivos", prisma.contributionAllocation.deleteMany({ where: onde })],
    ["lancamentos", prisma.monthlyEntry.deleteMany({ where: onde })],
    ["importacoes", prisma.importBatch.deleteMany({ where: onde })],
    ["orcamentos", prisma.budget.deleteMany({ where: onde })],
    ["planosDoMes", prisma.monthlyPlan.deleteMany({ where: onde })],
    ["resumosGuardados", prisma.yearlyConsolidationCache.deleteMany({ where: onde })],
    ["resumosGuardados", prisma.accumulationProjectionCache.deleteMany({ where: onde })],
    ["ativos", prisma.asset.deleteMany({ where: onde })],
    ["estrategia", prisma.portfolioStrategy.deleteMany({ where: onde })],
    ["historicoDoPatrimonio", prisma.patrimonySnapshot.deleteMany({ where: onde })],
    ["fichasDeAnalise", prisma.analysisSheet.deleteMany({ where: onde })], // respostas caem em cascata
    ["calculadorasSalvas", prisma.simulation.deleteMany({ where: onde })],
    ["reserva", prisma.emergencyFund.deleteMany({ where: onde })],
    ["planejamento", prisma.planningParams.deleteMany({ where: onde })],
    ["regrasDeCategoria", prisma.transactionCategoryRule.deleteMany({ where: onde })],
    // Meta ou categoria que um lançamento do PAR ainda usa (Nós dois) fica: apagar travaria a
    // chave estrangeira, e soltar o lançamento dele seria mexer no dado do par.
    ["metas", prisma.goal.deleteMany({ where: { ...onde, entries: { none: {} }, assets: { none: {} } } })],
    ["fotosDeMetas", prisma.fotoDaMeta.deleteMany({ where: onde })],
    ["categoriasCriadas", prisma.customCategory.deleteMany({ where: { ...onde, monthlyEntries: { none: {} }, budgets: { none: {} } } })],
    ["decisoes", prisma.decisao.deleteMany({ where: { AND: [onde, { NOT: { OR: ficam } }] } })],
    ["contasAPagar", prisma.contaAPagar.deleteMany({ where: onde })],
    ["contasRecusadas", prisma.contaRecusada.deleteMany({ where: onde })],
    ["dividas", prisma.divida.deleteMany({ where: onde })],
    ["achadosDinheiroPerdido", prisma.achadoDinheiroPerdido.deleteMany({ where: onde })],
    ["fechamentosDoMes", prisma.fechamentoDoMes.deleteMany({ where: { userId, profileId: { in: alvo } } })],
    // O fechamento a dois é do perfil (sem userId): sai só quando quem limpa é a titular.
    ["fechamentosDoCasal", prisma.fechamentoCasal.deleteMany({ where: { profileId: { in: casaisDaDona } } })],
    ["conexoesBancarias", prisma.bankConnection.deleteMany({ where: { userId, id: { in: idsDasConexoes } } })],
  ];
  // Arquivos e diagnósticos de importação não guardam perfil: saem só quando ela limpa tudo.
  if (opcoes.escopo === "todos") {
    apagar.push(["arquivosDeImportacao", prisma.importFile.deleteMany({ where: { userId } })]);
    apagar.push(["diagnosticosDeImportacao", prisma.importDiagnostic.deleteMany({ where: { userId } })]);
  }

  const ajustes = [
    // O perfil continua (nome, tipo, ícone, tema); o que ela configurou de DINHEIRO nele volta
    // ao de fábrica: categorias renomeadas ou escondidas, o assistente da Empresa, o limite do
    // cartão, o perfil de investidora e os meses acertados do casal.
    ...meusNoAlvo.map((p) =>
      prisma.financialProfile.update({
        where: { id: p.id },
        data: {
          categorias: Prisma.DbNull,
          empresa: Prisma.DbNull,
          limiteCartao: null,
          perfilInvestidor: null,
          ...(p.kind === "CASAL" && p.casal !== null ? { casal: casalParaRecomecar(p.casal) as unknown as Prisma.InputJsonValue } : {}),
        },
      }),
    ),
    // Volta ao começo (a porta do primeiro lançamento), como uma conta nova: sem `onboardedAt`, o
    // layout do app manda para /comecar, e o começo abre no passo "porta". O par não passa pelo
    // começo (entra pelo convite), então a conta dele não muda.
    ...(usuario
      ? [prisma.user.update({ where: { id: userId }, data: { comeco: comecoParaRecomecar(usuario.comeco) as unknown as Prisma.InputJsonValue, onboardedAt: null } })]
      : []),
    // O registro de que a limpeza aconteceu (sem conteúdo): é também o que conta o limite por hora.
    prisma.usageEvent.create({ data: { userId, name: EVENTO_DADOS_LIMPOS, path: `/configuracoes/limpar/${opcoes.escopo}` } }),
  ];

  const resultados = await prisma.$transaction([...apagar.map(([, p]) => p), ...ajustes]);
  const contagens = contagensZeradas();
  apagar.forEach(([chave], i) => {
    contagens[chave] += (resultados[i] as Prisma.BatchPayload).count;
  });

  return {
    perfis: alvo.length,
    itensPluggy: conexoes.filter((c) => idsDasConexoes.includes(c.id)).map((c) => c.itemId),
    contagens,
  };
}
