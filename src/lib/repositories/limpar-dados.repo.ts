import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import {
  DECISOES_DAS_METAS,
  DECISOES_DO_ORCAMENTO,
  DECISOES_QUE_FICAM,
  EVENTO_DADOS_LIMPOS,
  LIMITE_DE_LIMPEZAS,
  PREFIXO_DO_MONEY_RESET,
  casalParaRecomecar,
  comDependencias,
  comecoParaRecomecar,
  conexoesDosPerfis,
  contagensZeradas,
  type ContagensDaLimpeza,
  type EscopoDaLimpeza,
  type Parte,
  voltaAoComeco,
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
 * Sai, só de quem pediu (userId), só dos perfis limpos (profileId) e só das partes escolhidas
 * (ver PARTES e PRECISA_DE em regras.ts): ver a lista em ContagensDaLimpeza. Tudo numa transação
 * só: ou limpa tudo, ou nada.
 *
 * No Nós dois, o "só meu" do par é gravado com o userId DELE (ver casal-login/privacidade.ts),
 * então o filtro userId + profileId nunca alcança o par. Quando quem limpa é o par, sai só o que
 * é dele dentro do Casal, e o combinado do casal fica com a titular.
 */

export type OpcoesDaLimpeza = {
  escopo: EscopoDaLimpeza;
  /** Com escopo "perfil": qual perfil (um dos dela, ou o Casal aberto agora). Sem ele, o aberto agora. */
  perfilId?: string;
  /** O que sai. Já vem com as dependências aplicadas (lerPartes/comDependencias); aqui elas são aplicadas de novo. */
  partes: readonly Parte[];
};

/** O perfil escolhido não é dela: nada é apagado. */
export class PerfilDeOutraPessoa extends Error {
  constructor() {
    super("perfil de outra pessoa");
  }
}

export type ResultadoDaLimpeza = {
  contagens: ContagensDaLimpeza;
  perfis: number;
  /** As partes que saíram, com as dependências. */
  partes: Parte[];
  /** Voltou ao começo (sem `onboardedAt`): os lançamentos saíram e quem limpou não é o par. */
  recomecar: boolean;
  /** Itens da Pluggy das conexões removidas aqui: a revogação lá fora fica para quem chama. */
  itensPluggy: string[];
};

/** A conta a pagar que o app achou no extrato (ContaAPagar.origem). */
const ORIGEM_DO_HISTORICO = "historico";

/** Cabe mais uma limpeza agora? (no máximo LIMITE_DE_LIMPEZAS.maximo por hora, por conta) */
export async function cabeMaisUmaLimpeza(userId: string, agora = new Date()): Promise<boolean> {
  const desde = new Date(agora.getTime() - LIMITE_DE_LIMPEZAS.janelaMs);
  const feitas = await prisma.usageEvent.count({ where: { userId, name: EVENTO_DADOS_LIMPOS, createdAt: { gte: desde } } });
  return feitas < LIMITE_DE_LIMPEZAS.maximo;
}

export async function limparDados(ctx: AuthContext, opcoes: OpcoesDaLimpeza): Promise<ResultadoDaLimpeza> {
  const userId = ctx.userId;
  const ehPar = Boolean(ctx.par && ctx.donoId && ctx.donoId !== userId);
  const partes = comDependencias(opcoes.partes);
  const sai = (p: Parte) => partes.includes(p);

  // Os perfis da própria pessoa (dona). O perfil ativo do par é o Casal da titular: entra no
  // escopo para apagar o lado dele, mas nunca nas mudanças do próprio perfil.
  const meus = await prisma.financialProfile.findMany({ where: { userId }, select: { id: true, kind: true, casal: true } });
  const escolhido = opcoes.perfilId ?? ctx.profileId;
  if (opcoes.escopo === "perfil" && escolhido !== ctx.profileId && !meus.some((p) => p.id === escolhido)) throw new PerfilDeOutraPessoa();
  const alvo = opcoes.escopo === "todos" ? [...new Set([...meus.map((p) => p.id), ctx.profileId])] : [escolhido];
  const meusNoAlvo = meus.filter((p) => alvo.includes(p.id));
  const casaisDaDona = meusNoAlvo.filter((p) => p.kind === "CASAL").map((p) => p.id);

  // "Todos" também leva o histórico de antes dos perfis (profileId nulo), que é da conta toda.
  const onde = opcoes.escopo === "todos" ? { userId, OR: [{ profileId: { in: alvo } }, { profileId: null }] } : { userId, profileId: { in: alvo } };

  // Bancos conectados que só alimentam os perfis limpos (ver conexoesDosPerfis). Saem com os
  // lançamentos: são eles que trazem os lançamentos.
  const conexoes = sai("lancamentos") ? await prisma.bankConnection.findMany({ where: { userId }, select: { id: true, itemId: true, connectorName: true } }) : [];
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

  // As metas que saem: o lançamento ou o investimento DELA que aponta para uma delas e fica
  // (porque Lançamentos ou Carteira não saem) perde só o vínculo, antes da meta sair.
  const idsDasMetas = sai("metas") && (!sai("lancamentos") || !sai("carteira")) ? (await prisma.goal.findMany({ where: onde, select: { id: true } })).map((g) => g.id) : [];

  // As decisões que saem, pela parte de cada tipo (ver DECISOES_* em regras.ts).
  const decisoes: Prisma.DecisaoWhereInput[] = [];
  if (sai("lancamentos")) {
    decisoes.push({
      NOT: { OR: [{ tipo: { in: [...DECISOES_QUE_FICAM, ...DECISOES_DO_ORCAMENTO, ...DECISOES_DAS_METAS] } }, { tipo: { startsWith: PREFIXO_DO_MONEY_RESET } }] },
    });
  }
  if (sai("orcamento")) decisoes.push({ tipo: { in: [...DECISOES_DO_ORCAMENTO] } });
  if (sai("metas")) decisoes.push({ tipo: { in: [...DECISOES_DAS_METAS] } });
  if (sai("moneyReset")) decisoes.push({ tipo: { startsWith: PREFIXO_DO_MONEY_RESET } });

  const recomecar = voltaAoComeco(partes) && !ehPar;
  const usuario = recomecar ? await prisma.user.findUnique({ where: { id: userId }, select: { comeco: true } }) : null;

  // A ordem respeita as chaves estrangeiras sem cascata: vínculos soltos antes, lançamentos e
  // ativos antes de metas e categorias, aportes antes de tudo. Cada passo diz em que contagem
  // ele soma (null = não conta, é ajuste).
  type Passo = [keyof ContagensDaLimpeza | null, Prisma.PrismaPromise<unknown>];
  const passos: Passo[] = [];
  const apaga = (chave: keyof ContagensDaLimpeza, p: Prisma.PrismaPromise<Prisma.BatchPayload>) => passos.push([chave, p]);

  if (idsDasMetas.length > 0 && !sai("lancamentos")) passos.push([null, prisma.monthlyEntry.updateMany({ where: { userId, goalId: { in: idsDasMetas } }, data: { goalId: null } })]);
  if (idsDasMetas.length > 0 && !sai("carteira")) passos.push([null, prisma.asset.updateMany({ where: { userId, goalId: { in: idsDasMetas } }, data: { goalId: null } })]);

  if (sai("lancamentos") || sai("carteira")) apaga("aportesEmAtivos", prisma.contributionAllocation.deleteMany({ where: onde }));
  if (sai("lancamentos")) {
    apaga("lancamentos", prisma.monthlyEntry.deleteMany({ where: onde }));
    apaga("importacoes", prisma.importBatch.deleteMany({ where: onde }));
  }
  if (sai("orcamento")) {
    apaga("orcamentos", prisma.budget.deleteMany({ where: onde }));
    apaga("planosDoMes", prisma.monthlyPlan.deleteMany({ where: onde }));
  }
  // Os cartões cadastrados (15/10/2026) são configuração do orçamento, como o limite do cartão:
  // saem com ele. Lançamento que fica perde só a ligação (SetNull) e continua "no cartão".
  if (sai("orcamento")) passos.push([null, prisma.cartao.deleteMany({ where: { userId, profileId: { in: alvo } } })]);
  // Os resumos guardados são contas feitas em cima de tudo: saem sempre, e o app refaz.
  apaga("resumosGuardados", prisma.yearlyConsolidationCache.deleteMany({ where: onde }));
  apaga("resumosGuardados", prisma.accumulationProjectionCache.deleteMany({ where: onde }));
  if (sai("carteira")) {
    apaga("ativos", prisma.asset.deleteMany({ where: onde }));
    apaga("estrategia", prisma.portfolioStrategy.deleteMany({ where: onde }));
    apaga("historicoDoPatrimonio", prisma.patrimonySnapshot.deleteMany({ where: onde }));
    apaga("fichasDeAnalise", prisma.analysisSheet.deleteMany({ where: onde })); // respostas caem em cascata
  }
  if (sai("calculadoras")) {
    apaga("calculadorasSalvas", prisma.simulation.deleteMany({ where: onde }));
    apaga("planejamento", prisma.planningParams.deleteMany({ where: onde }));
  }
  if (sai("categorias")) apaga("regrasDeCategoria", prisma.transactionCategoryRule.deleteMany({ where: onde }));
  // "Sempre mandar para a Empresa" é regra aprendida como a de categoria: sai junto.
  if (sai("categorias")) apaga("regrasDeCategoria", prisma.regraDePerfil.deleteMany({ where: { userId, profileId: { in: alvo } } }));
  // Casal simples: o "Da casa" aprendido por comerciante também é regra aprendida.
  if (sai("categorias")) apaga("regrasDeCategoria", prisma.regraDaCasa.deleteMany({ where: { userId, profileId: { in: alvo } } }));
  if (sai("metas")) {
    apaga("reserva", prisma.emergencyFund.deleteMany({ where: onde }));
    // Meta ou categoria que um lançamento do PAR ainda usa (Nós dois) fica: apagar travaria a
    // chave estrangeira, e soltar o lançamento dele seria mexer no dado do par.
    apaga("metas", prisma.goal.deleteMany({ where: { ...onde, entries: { none: {} }, assets: { none: {} } } }));
    apaga("fotosDeMetas", prisma.fotoDaMeta.deleteMany({ where: onde }));
  }
  if (sai("categorias")) apaga("categoriasCriadas", prisma.customCategory.deleteMany({ where: { ...onde, monthlyEntries: { none: {} }, budgets: { none: {} } } }));
  if (decisoes.length > 0) apaga("decisoes", prisma.decisao.deleteMany({ where: { AND: [onde, { OR: decisoes }] } }));
  if (sai("contas")) {
    apaga("contasAPagar", prisma.contaAPagar.deleteMany({ where: onde }));
    apaga("contasRecusadas", prisma.contaRecusada.deleteMany({ where: onde }));
    apaga("dividas", prisma.divida.deleteMany({ where: onde }));
  } else if (sai("lancamentos")) {
    // As contas que o app achou no extrato são calculadas dos lançamentos: saem com eles.
    apaga("contasAPagar", prisma.contaAPagar.deleteMany({ where: { ...onde, origem: ORIGEM_DO_HISTORICO } }));
  }
  if (sai("lancamentos")) {
    apaga("achadosDinheiroPerdido", prisma.achadoDinheiroPerdido.deleteMany({ where: onde }));
    apaga("fechamentosDoMes", prisma.fechamentoDoMes.deleteMany({ where: { userId, profileId: { in: alvo } } }));
    // O fechamento a dois é do perfil (sem userId): sai só quando quem limpa é a titular.
    apaga("fechamentosDoCasal", prisma.fechamentoCasal.deleteMany({ where: { profileId: { in: casaisDaDona } } }));
    apaga("conexoesBancarias", prisma.bankConnection.deleteMany({ where: { userId, id: { in: idsDasConexoes } } }));
    // Arquivos e diagnósticos de importação não guardam perfil: saem só quando ela limpa tudo.
    if (opcoes.escopo === "todos") {
      apaga("arquivosDeImportacao", prisma.importFile.deleteMany({ where: { userId } }));
      apaga("diagnosticosDeImportacao", prisma.importDiagnostic.deleteMany({ where: { userId } }));
    }
  }

  // O perfil continua (nome, tipo, ícone, tema); o que ela configurou de DINHEIRO nele volta ao
  // de fábrica, cada coisa com a sua parte.
  for (const p of meusNoAlvo) {
    const data: Prisma.FinancialProfileUpdateInput = {
      ...(sai("categorias") ? { categorias: Prisma.DbNull } : {}),
      ...(sai("orcamento") ? { empresa: Prisma.DbNull, limiteCartao: null } : {}),
      ...(sai("carteira") ? { perfilInvestidor: null } : {}),
      // Os meses acertados do casal fecharam lançamentos que saíram.
      ...(sai("lancamentos") && p.kind === "CASAL" && p.casal !== null ? { casal: casalParaRecomecar(p.casal) as unknown as Prisma.InputJsonValue } : {}),
    };
    if (Object.keys(data).length > 0) passos.push([null, prisma.financialProfile.update({ where: { id: p.id }, data })]);
  }
  // Volta ao começo (a porta do primeiro lançamento), como uma conta nova: sem `onboardedAt`, o
  // layout do app manda para /comecar, e o começo abre no passo "porta". O par não passa pelo
  // começo (entra pelo convite), então a conta dele não muda.
  if (usuario) {
    passos.push([null, prisma.user.update({ where: { id: userId }, data: { comeco: comecoParaRecomecar(usuario.comeco) as unknown as Prisma.InputJsonValue, onboardedAt: null } })]);
  }
  // O registro de que a limpeza aconteceu (sem conteúdo): é também o que conta o limite por hora.
  passos.push([null, prisma.usageEvent.create({ data: { userId, name: EVENTO_DADOS_LIMPOS, path: `/configuracoes/limpar/${opcoes.escopo}` } })]);

  // Tudo numa transação só: ou limpa tudo, ou nada.
  const resultados = await prisma.$transaction(passos.map(([, p]) => p));
  const contagens = contagensZeradas();
  passos.forEach(([chave], i) => {
    if (chave) contagens[chave] += (resultados[i] as Prisma.BatchPayload).count;
  });

  return {
    perfis: alvo.length,
    partes,
    recomecar,
    itensPluggy: conexoes.filter((c) => idsDasConexoes.includes(c.id)).map((c) => c.itemId),
    contagens,
  };
}
