import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { registrarDecisaoUnica } from "@/lib/repositories/decisao.repo";
import { hojeEmBrasilia } from "@/lib/contas/contas";
import { abriuEm, acheiPorMes, estadoDoReset, marcosFeitos, type EstadoDoReset } from "@/lib/money-reset/progresso";
import { marco } from "@/lib/money-reset/missoes";
import { acharMetaDaReserva } from "@/lib/portfolio/reserva-da-pessoa";

/**
 * O progresso do Money Reset mora na tabela de decisões (sem tabela nova, sem migration):
 *  - "reset|marco|N": o marco N da versão A+B (12/10/2026) feito;
 *  - "reset|dia|N" e "reset|inicio": o que a versão de 05/10 gravou. NUNCA são apagados nem
 *    reescritos; o novo só lê e traduz (progresso.ts, `marcosFeitos`), então dá para voltar atrás;
 *  - "reset|<campo>": as respostas (motivo, regra do cartão, 9 passos...), as mesmas chaves de antes,
 *    por isso já aparecem preenchidas.
 */

export type CampoDeResposta =
  | "motivo"
  | "regra"
  | "passos"
  | "desafio"
  | "recompensa"
  | "dica"
  | "negociar"
  | "divisao"
  | "fixas"
  | "fatura"
  | "dividas"
  | "historia1"
  | "historia2"
  | "historia3";

export const CAMPOS_DE_RESPOSTA: readonly CampoDeResposta[] = ["motivo", "regra", "passos", "desafio", "recompensa", "dica", "negociar", "divisao", "fixas", "fatura", "dividas", "historia1", "historia2", "historia3"];

export type ResetDaPessoa = {
  feitos: Map<number, Date>;
  respostas: Partial<Record<CampoDeResposta, { texto: string; dados: unknown }>>;
  estado: EstadoDoReset;
  /** O placar "Achei R$ X por mês" (só cresce com o que ela decide; zero sem decisão). */
  achei: number;
  /** Hoje, no calendário de Brasília (meia-noite UTC), para o desafio do dia sem gasto. */
  hoje: Date;
};

const TIPOS = ["reset_inicio", "reset_dia", "reset_marco", "reset_resposta"] as const;
const RAIOX = ["raiox_cancelar", "raiox_metade", "raiox_manter"];

export async function lerReset(ctx: AuthContext): Promise<ResetDaPessoa> {
  const dono = doDono(ctx);
  const [linhas, raiox] = await Promise.all([
    prisma.decisao.findMany({ where: { ...dono, tipo: { in: [...TIPOS] } }, orderBy: { createdAt: "asc" } }),
    prisma.decisao.findMany({ where: { ...dono, tipo: { in: RAIOX } }, select: { tipo: true, valor: true } }),
  ]);
  const diasAntigos = new Map<number, Date>();
  const marcos = new Map<number, Date>();
  const respostas: ResetDaPessoa["respostas"] = {};
  for (const l of linhas) {
    const partes = l.chave?.split("|") ?? [];
    if (l.tipo === "reset_dia") {
      const n = Number(partes[2]);
      if (n >= 1 && n <= 21 && !diasAntigos.has(n)) diasAntigos.set(n, l.createdAt);
    } else if (l.tipo === "reset_marco") {
      const n = Number(partes[2]);
      if (n >= 1 && n <= 21 && !marcos.has(n)) marcos.set(n, l.createdAt);
    } else if (l.tipo === "reset_resposta") {
      const campo = partes[1] as CampoDeResposta | undefined;
      if (campo) respostas[campo] = { texto: l.descricao ?? "", dados: l.dados };
    }
  }
  const feitos = marcosFeitos({ marcos, diasAntigos });
  const negociado = Number((respostas.fixas?.dados as { baixou?: unknown } | undefined)?.baixou ?? 0);
  const achei = acheiPorMes({ raiox: raiox.map((r) => ({ tipo: r.tipo, valorAnual: Number(r.valor ?? 0) })), negociado: Number.isFinite(negociado) ? negociado : 0 });
  return { feitos, respostas, estado: estadoDoReset(feitos), achei, hoje: hojeEmBrasilia() };
}

export async function marcarMarcoFeito(ctx: AuthContext, n: number) {
  return registrarDecisaoUnica(ctx, { tipo: "reset_marco", chave: `reset|marco|${n}` });
}

export async function salvarResposta(ctx: AuthContext, campo: CampoDeResposta, texto: string, dados?: unknown) {
  return registrarDecisaoUnica(ctx, { tipo: "reset_resposta", chave: `reset|${campo}`, descricao: texto.slice(0, 200), dados: dados === undefined ? undefined : (dados as object) });
}

/**
 * Os marcos que o app confere sozinho, pelo que já existe nos dados dela. Roda para o marco atual.
 * Os da semana 2 contam quando o app já vê o resultado (orçamento montado, reserva com alvo, meta
 * criada), como diz a proposta; os de evento contam o que ela fez desde que o marco abriu.
 * Devolve true se marcou.
 */
export async function conferirMarcoAtual(ctx: AuthContext, reset: ResetDaPessoa): Promise<boolean> {
  const { estado, feitos } = reset;
  if (estado.fase !== "andamento" || estado.atual === null) return false;
  const n = estado.atual;
  const m = marco(n);
  if (!m || m.confere !== "auto") return false;
  const desde = abriuEm(n, feitos);
  const dono = doDono(ctx);
  const decisaoDesde = (tipos: string[]) => prisma.decisao.count({ where: { ...dono, tipo: { in: tipos }, createdAt: { gte: desde } } });

  let feita = false;
  switch (n) {
    case 2:
      feita = (await prisma.importBatch.count({ where: { ...dono, docType: "fatura", createdAt: { gte: desde } } })) > 0;
      break;
    case 6:
      // O que não passa pelo extrato: um gasto lançado à mão ou por voz desde que a missão abriu.
      feita = (await prisma.monthlyEntry.count({ where: { ...dono, importBatchId: null, category: "EXPENSE", createdAt: { gte: desde } } })) > 0;
      break;
    case 8: {
      const agora = new Date(Date.now() - 3 * 3_600_000);
      feita = (await prisma.budget.count({ where: { ...dono, year: agora.getUTCFullYear(), month: agora.getUTCMonth() + 1, plannedAmount: { gt: 0 } } })) > 0;
      break;
    }
    case 10: {
      // A tela da Reserva saiu em 11/10: a reserva é a meta do tipo Reserva de emergência. Quem
      // ainda tem a do simulador antigo também conta.
      const [antiga, metas] = await Promise.all([
        prisma.emergencyFund.count({ where: { ...dono, targetAmount: { gt: 0 } } }),
        prisma.goal.findMany({ where: { ...dono, targetAmount: { gt: 0 } }, select: { icon: true, name: true } }),
      ]);
      feita = antiga > 0 || acharMetaDaReserva(metas) !== null;
      break;
    }
    case 11: {
      // O sonho é uma meta que não seja a reserva (a reserva é a missão 10).
      const metas = await prisma.goal.findMany({ where: dono, select: { id: true, icon: true, name: true } });
      const reserva = acharMetaDaReserva(metas);
      feita = metas.some((g) => g.id !== reserva?.id);
      break;
    }
    case 16:
      feita = (await decisaoDesde(["compra_desisti", "compra_amanha", "compra_comprei"])) > 0;
      break;
    case 17: {
      // O desafio é no dia que ela topou (o dia seguinte): passou o dia e não teve lazer nem compra.
      const data = reset.respostas.desafio?.texto;
      if (!data) break;
      const alvo = new Date(`${data}T00:00:00Z`);
      if (Number.isNaN(alvo.getTime()) || reset.hoje.getTime() <= alvo.getTime()) break;
      const escorregou = await prisma.monthlyEntry.count({ where: { ...dono, category: "EXPENSE", parentCategory: { in: ["LAZER", "OUTROS"] }, entryDate: { gte: alvo, lt: new Date(alvo.getTime() + 86_400_000) } } });
      feita = escorregou === 0;
      break;
    }
    case 18:
      feita = (await decisaoDesde(["ritual"])) > 0;
      break;
  }
  if (feita) await marcarMarcoFeito(ctx, n);
  return feita;
}

/** Lê o reset e já confere o marco atual (se marcou, lê de novo). */
export async function lerResetConferido(ctx: AuthContext): Promise<ResetDaPessoa> {
  const reset = await lerReset(ctx);
  return (await conferirMarcoAtual(ctx, reset)) ? lerReset(ctx) : reset;
}
