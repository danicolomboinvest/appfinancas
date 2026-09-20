import { prisma } from "@/lib/db/prisma";

/**
 * O funil de ativação e quem ficou preso nele.
 *
 * O relatório já dizia quantas pessoas usam cada funcionalidade, mas cada número vivia sozinho:
 * "27 têm orçamento" não conta se elas não chegaram lá ou se desistiram no caminho. A pergunta
 * que decide o que fazer a seguir não é "quantas usam", é ONDE elas param.
 *
 * Foi olhando isso que apareceram as duas coisas que mais importam hoje: 70 pessoas que pagaram
 * e nunca abriram (quase todas de um único lote de agosto), e 50 que abriram, navegaram pelo app
 * e nunca conseguiram pôr um dado dentro. Nenhuma das duas dá pra ver numa lista de porcentagens.
 */

export type PassoDoFunil = {
  label: string;
  /** Quantas pessoas chegaram até aqui. */
  pessoas: number;
  /** Fração do total de contas. */
  doTotal: number;
  /** Quantas se perderam do passo anterior pra este. */
  perdidas: number;
};

export type PessoaTravada = {
  userId: string;
  nome: string | null;
  email: string;
  /** Dias desde que abriu o app pela última vez. Null = nunca abriu. */
  diasDesdeUltimoAcesso: number | null;
  /** Quantas páginas já viu. Zero = nunca abriu. */
  paginasVistas: number;
  criadaEm: Date;
};

export type CoorteSemanal = {
  semana: string;
  entraram: number;
  /** Destas, quantas chegaram a abrir o app alguma vez. */
  abriram: number;
  /** Destas, quantas lançaram alguma coisa. */
  lancaram: number;
  /** Destas, quantas continuam aparecendo (últimos 14 dias). */
  aindaAtivas: number;
};

export type FunilDeAdocao = {
  totalContas: number;
  passos: PassoDoFunil[];
  /** Pagou e nunca abriu: o grupo mais caro, porque nem chegou a ver o produto. */
  nuncaAbriram: PessoaTravada[];
  /** Abriu, andou pelo app e não conseguiu registrar nada. */
  abriramSemLancar: PessoaTravada[];
  coortes: CoorteSemanal[];
  /** Como o dado entra: importado de arquivo x digitado/falado. */
  origemDosLancamentos: { importados: number; manuais: number };
  /** Qual caminho de registro a pessoa ESCOLHE. Só existe pra quem usou o app depois da medição. */
  caminhoEscolhido: { voz: number; digitado: number; importacao: number };
};

/**
 * Monta os passos com a queda entre eles.
 *
 * Cada passo precisa ser um SUBCONJUNTO do anterior, senão "perdidas" vira número negativo e o
 * funil mente: criar meta não exige ter orçamento, então contar as duas coisas lado a lado dava
 * "−(−3) pessoas perdidas". Aqui cada passo conta só quem fez tudo o que veio antes — que é o
 * que a palavra funil promete.
 */
export function montarPassos(cru: { label: string; pessoas: number }[], total: number): PassoDoFunil[] {
  return cru.map((p, i) => ({
    label: p.label,
    pessoas: p.pessoas,
    doTotal: total > 0 ? p.pessoas / total : 0,
    perdidas: i === 0 ? 0 : Math.max(0, cru[i - 1].pessoas - p.pessoas),
  }));
}

/** Segunda-feira da semana da data, em ISO curto, pra agrupar coortes. */
export function semanaDe(d: Date): string {
  const data = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diaDaSemana = (data.getDay() + 6) % 7; // segunda = 0
  data.setDate(data.getDate() - diaDaSemana);
  return data.toISOString().slice(0, 10);
}

export async function getFunilDeAdocao(): Promise<FunilDeAdocao> {
  const agora = Date.now();
  const users = await prisma.user.findMany({
    where: { role: "CLIENT" },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  const ids = users.map((u) => u.id);

  const [eventos, comLancamento, comOrcamento, comMeta, comCarteira, lancamentos] = await Promise.all([
    prisma.usageEvent.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _count: true,
      _max: { createdAt: true },
    }),
    prisma.monthlyEntry.findMany({ where: { userId: { in: ids } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.budget.findMany({ where: { userId: { in: ids } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.goal.findMany({ where: { userId: { in: ids } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.asset.findMany({ where: { userId: { in: ids } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.monthlyEntry.groupBy({ by: ["importBatchId"], where: { userId: { in: ids } }, _count: true }),
  ]);

  // Digitar e ditar terminam idênticos na tabela de lançamentos, então a única forma de separar
  // é o evento gravado na hora da escolha.
  const escolhas = await prisma.usageEvent.groupBy({
    by: ["name"],
    where: { userId: { in: ids }, name: { in: ["registro_voz", "registro_digitado", "registro_importacao"] } },
    _count: true,
  });
  const contaEvento = (nome: string) => escolhas.find((e) => e.name === nome)?._count ?? 0;

  const uso = new Map(eventos.map((e) => [e.userId, e]));
  const lancou = new Set(comLancamento.map((r) => r.userId));
  const orcou = new Set(comOrcamento.map((r) => r.userId));
  const meteou = new Set(comMeta.map((r) => r.userId));
  const investiu = new Set(comCarteira.map((r) => r.userId));

  const total = users.length;
  // Encaixado de verdade: cada passo só conta quem fez TUDO o que veio antes.
  const abriuApp = (id: string) => uso.has(id);
  const passo2 = users.filter((u) => abriuApp(u.id));
  const passo3 = passo2.filter((u) => lancou.has(u.id));
  const passo4 = passo3.filter((u) => orcou.has(u.id));
  const passo5 = passo4.filter((u) => meteou.has(u.id) || investiu.has(u.id));

  const passos = montarPassos(
    [
      { label: "Tem conta", pessoas: total },
      { label: "Abriu o app", pessoas: passo2.length },
      { label: "Lançou alguma coisa", pessoas: passo3.length },
      { label: "Definiu orçamento", pessoas: passo4.length },
      { label: "Criou meta ou carteira", pessoas: passo5.length },
    ],
    total,
  );

  const comoTravada = (u: (typeof users)[number]): PessoaTravada => {
    const e = uso.get(u.id);
    return {
      userId: u.id,
      nome: u.name,
      email: u.email,
      diasDesdeUltimoAcesso: e?._max.createdAt ? Math.floor((agora - e._max.createdAt.getTime()) / 86_400_000) : null,
      paginasVistas: e?._count ?? 0,
      criadaEm: u.createdAt,
    };
  };

  // Mais antigas primeiro: quem está parada há mais tempo é quem está mais perto de pedir dinheiro de volta.
  const nuncaAbriram = users.filter((u) => !uso.has(u.id)).map(comoTravada).sort((a, b) => +a.criadaEm - +b.criadaEm);
  const abriramSemLancar = users
    .filter((u) => uso.has(u.id) && !lancou.has(u.id))
    .map(comoTravada)
    .sort((a, b) => (a.diasDesdeUltimoAcesso ?? 999) - (b.diasDesdeUltimoAcesso ?? 999));

  // Coortes por semana de entrada: é o que denuncia um lote inteiro que entrou e nunca ativou.
  const porSemana = new Map<string, CoorteSemanal>();
  for (const u of users) {
    const chave = semanaDe(u.createdAt);
    const c = porSemana.get(chave) ?? { semana: chave, entraram: 0, abriram: 0, lancaram: 0, aindaAtivas: 0 };
    c.entraram += 1;
    const e = uso.get(u.id);
    if (e) c.abriram += 1;
    if (lancou.has(u.id)) c.lancaram += 1;
    if (e?._max.createdAt && agora - e._max.createdAt.getTime() <= 14 * 86_400_000) c.aindaAtivas += 1;
    porSemana.set(chave, c);
  }

  let importados = 0;
  let manuais = 0;
  for (const linha of lancamentos) {
    if (linha.importBatchId) importados += linha._count;
    else manuais += linha._count;
  }

  return {
    totalContas: total,
    passos,
    nuncaAbriram,
    abriramSemLancar,
    coortes: [...porSemana.values()].sort((a, b) => a.semana.localeCompare(b.semana)),
    origemDosLancamentos: { importados, manuais },
    caminhoEscolhido: {
      voz: contaEvento("registro_voz"),
      digitado: contaEvento("registro_digitado"),
      importacao: contaEvento("registro_importacao"),
    },
  };
}
