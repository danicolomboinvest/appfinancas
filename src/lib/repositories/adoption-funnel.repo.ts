import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";

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
  /** Dias desde que abriu o app pela última vez. Null = sem data (nunca abriu, ou só usou antes do rastreio). */
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

/**
 * Segunda-feira da semana da data, em ISO curto, pra agrupar coortes.
 *
 * O dia é o do calendário de Brasília: `d` é um instante real (createdAt), e lido no fuso do
 * servidor (UTC na Vercel) quem se cadastrava domingo depois das 21h já era segunda e caía na
 * coorte da semana seguinte. A conta de dias é em UTC pra não depender do fuso da máquina.
 */
export function semanaDe(d: Date): string {
  const b = nowInBrazil(d);
  const data = new Date(Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()));
  const diaDaSemana = (data.getUTCDay() + 6) % 7; // segunda = 0
  data.setUTCDate(data.getUTCDate() - diaDaSemana);
  return data.toISOString().slice(0, 10);
}

/**
 * Último sinal de que a pessoa esteve no app: o evento mais recente ou o lastSeenAt, o que for
 * mais novo. O UsageEvent só começou a ser gravado em 03/08/2026; quem usou antes disso só tem
 * o lastSeenAt (desde 23/07) — ou nem isso, e aí só os lançamentos provam que ela entrou.
 */
export function ultimoAcesso(ultimoEvento: Date | null | undefined, lastSeenAt: Date | null): Date | null {
  if (!ultimoEvento) return lastSeenAt;
  if (!lastSeenAt) return ultimoEvento;
  return ultimoEvento > lastSeenAt ? ultimoEvento : lastSeenAt;
}

/**
 * Abriu o app = qualquer rastro de uso: evento, lastSeenAt ou lançamento. Contar só o
 * UsageEvent jogava a aluna de julho, com dezenas de lançamentos, no card "Pagaram e nunca
 * abriram" (e a tirava de "Lançou alguma coisa", porque o funil é encaixado).
 */
export function abriuOApp(u: { temEvento: boolean; lastSeenAt: Date | null; lancou: boolean }): boolean {
  return u.temEvento || u.lastSeenAt !== null || u.lancou;
}

export async function getFunilDeAdocao(): Promise<FunilDeAdocao> {
  const agora = Date.now();
  const users = await prisma.user.findMany({
    where: { role: "CLIENT" },
    select: { id: true, name: true, email: true, createdAt: true, lastSeenAt: true },
  });
  const ids = users.map((u) => u.id);

  const [eventos, comLancamento, comOrcamento, comMeta, comCarteira, lancamentos, liberados] = await Promise.all([
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
    // Quem pagou: está na lista de acesso ativa (manual ou Hubla). Desde o freemium qualquer
    // e-mail cria conta, então role=CLIENT sozinho não quer dizer que pagou.
    prisma.allowedEmail.findMany({ where: { active: true }, select: { email: true } }),
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
  const pagantes = new Set(liberados.map((r) => r.email));

  const total = users.length;
  const abriuApp = (u: (typeof users)[number]) =>
    abriuOApp({ temEvento: uso.has(u.id), lastSeenAt: u.lastSeenAt, lancou: lancou.has(u.id) });
  const acessoDe = (u: (typeof users)[number]) => ultimoAcesso(uso.get(u.id)?._max.createdAt, u.lastSeenAt);
  // Encaixado de verdade: cada passo só conta quem fez TUDO o que veio antes.
  const passo2 = users.filter(abriuApp);
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
    const acesso = acessoDe(u);
    return {
      userId: u.id,
      nome: u.name,
      email: u.email,
      diasDesdeUltimoAcesso: acesso ? Math.floor((agora - acesso.getTime()) / 86_400_000) : null,
      paginasVistas: e?._count ?? 0,
      criadaEm: u.createdAt,
    };
  };

  // Mais antigas primeiro: quem está parada há mais tempo é quem está mais perto de pedir dinheiro de volta.
  const nuncaAbriram = users
    .filter((u) => !abriuApp(u) && pagantes.has(normalizeEmail(u.email)))
    .map(comoTravada)
    .sort((a, b) => +a.criadaEm - +b.criadaEm);
  const abriramSemLancar = users
    .filter((u) => abriuApp(u) && !lancou.has(u.id))
    .map(comoTravada)
    .sort((a, b) => (a.diasDesdeUltimoAcesso ?? 999) - (b.diasDesdeUltimoAcesso ?? 999));

  // Coortes por semana de entrada: é o que denuncia um lote inteiro que entrou e nunca ativou.
  const porSemana = new Map<string, CoorteSemanal>();
  for (const u of users) {
    const chave = semanaDe(u.createdAt);
    const c = porSemana.get(chave) ?? { semana: chave, entraram: 0, abriram: 0, lancaram: 0, aindaAtivas: 0 };
    c.entraram += 1;
    if (abriuApp(u)) c.abriram += 1;
    if (lancou.has(u.id)) c.lancaram += 1;
    const acesso = acessoDe(u);
    if (acesso && agora - acesso.getTime() <= 14 * 86_400_000) c.aindaAtivas += 1;
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
