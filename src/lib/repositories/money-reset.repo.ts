import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { registrarDecisaoUnica } from "@/lib/repositories/decisao.repo";
import { hojeEmBrasilia } from "@/lib/contas/contas";
import { abriuEm, estadoDoReset, type EstadoDoReset } from "@/lib/money-reset/progresso";
import { missao } from "@/lib/money-reset/missoes";

/**
 * O progresso do Money Reset mora na tabela de decisões (sem tabela nova): o Dia 0, cada dia
 * feito e as respostas (motivo, regra do cartão, 9 passos...). Chave "reset|..." por perfil.
 */

export type CampoDeResposta = "motivo" | "regra" | "passos" | "desafio" | "recompensa" | "dica" | "negociar" | "divisao" | "fixas";

export type ResetDaPessoa = {
  inicio: Date | null;
  feitas: Map<number, Date>;
  respostas: Partial<Record<CampoDeResposta, { texto: string; dados: unknown }>>;
  estado: EstadoDoReset;
  hoje: Date;
};

const TIPOS = ["reset_inicio", "reset_dia", "reset_resposta"] as const;
const BRASILIA_MS = 3 * 3_600_000;

export async function lerReset(ctx: AuthContext): Promise<ResetDaPessoa> {
  const linhas = await prisma.decisao.findMany({ where: { ...doDono(ctx), tipo: { in: [...TIPOS] } }, orderBy: { createdAt: "asc" } });
  let inicio: Date | null = null;
  const feitas = new Map<number, Date>();
  const respostas: ResetDaPessoa["respostas"] = {};
  for (const l of linhas) {
    const dia = hojeEmBrasilia(l.createdAt);
    if (l.tipo === "reset_inicio") inicio = dia;
    else if (l.tipo === "reset_dia") {
      const n = Number(l.chave?.split("|")[2]);
      if (n >= 1 && n <= 21) feitas.set(n, dia);
    } else {
      const campo = l.chave?.split("|")[1] as CampoDeResposta | undefined;
      if (campo) respostas[campo] = { texto: l.descricao ?? "", dados: l.dados };
    }
  }
  const hoje = hojeEmBrasilia();
  return { inicio, feitas, respostas, estado: estadoDoReset({ inicio, feitas, hoje }), hoje };
}

export async function comecarReset(ctx: AuthContext, separado: boolean[]) {
  return registrarDecisaoUnica(ctx, { tipo: "reset_inicio", chave: "reset|inicio", dados: { separado } });
}

export async function marcarDiaFeito(ctx: AuthContext, dia: number) {
  return registrarDecisaoUnica(ctx, { tipo: "reset_dia", chave: `reset|dia|${dia}` });
}

export async function salvarResposta(ctx: AuthContext, campo: CampoDeResposta, texto: string, dados?: unknown) {
  return registrarDecisaoUnica(ctx, { tipo: "reset_resposta", chave: `reset|${campo}`, descricao: texto.slice(0, 200), dados: dados === undefined ? undefined : (dados as object) });
}

/**
 * As missões que o app confere sozinho, pelo que já existe nos dados dela. Roda para a missão do
 * dia: se o que ela pedia já aconteceu (desde que a missão abriu, quando é um evento), marca feita.
 * Devolve true se marcou.
 */
export async function conferirMissaoDoDia(ctx: AuthContext, reset: ResetDaPessoa): Promise<boolean> {
  const { estado, inicio, feitas } = reset;
  if (estado.fase !== "andamento" || !estado.disponivel || !inicio || estado.atual === null) return false;
  const dia = estado.atual;
  const m = missao(dia);
  if (!m || m.confere !== "auto") return false;
  const desde = new Date(abriuEm({ dia, inicio, feitas }).getTime() + BRASILIA_MS);
  const dono = doDono(ctx);
  const decisaoDesde = (tipos: string[]) => prisma.decisao.count({ where: { ...dono, tipo: { in: tipos }, createdAt: { gte: desde } } });

  let feita = false;
  switch (dia) {
    case 1:
      feita = (await prisma.importBatch.count({ where: { ...dono, docType: "extrato" } })) > 0;
      break;
    case 2:
      feita = (await prisma.importBatch.count({ where: { ...dono, docType: "fatura" } })) > 0;
      break;
    case 4:
      feita = (await decisaoDesde(["raiox_cancelar", "raiox_metade", "raiox_manter"])) > 0;
      break;
    case 6:
      feita = (await decisaoDesde(["teto"])) > 0;
      break;
    case 8:
      feita = (await prisma.goal.count({ where: dono })) > 0;
      break;
    case 9:
      feita = (await prisma.emergencyFund.count({ where: { ...dono, targetAmount: { gt: 0 } } })) > 0;
      break;
    case 10: {
      const agora = new Date(Date.now() - BRASILIA_MS);
      feita = (await prisma.budget.count({ where: { ...dono, year: agora.getUTCFullYear(), month: agora.getUTCMonth() + 1, plannedAmount: { gt: 0 } } })) > 0;
      break;
    }
    case 15:
      feita = (await decisaoDesde(["compra_desisti", "compra_amanha", "compra_comprei"])) > 0;
      break;
    case 16:
      // O que não passa pelo extrato: um lançamento feito à mão ou por voz desde que a missão abriu.
      feita = (await prisma.monthlyEntry.count({ where: { ...dono, importBatchId: null, category: "EXPENSE", createdAt: { gte: desde } } })) > 0;
      break;
    case 17: {
      // O desafio é no dia que ela topou (o dia seguinte): passou o dia e não teve lazer nem compra.
      const data = reset.respostas.desafio?.texto;
      if (!data) break;
      const alvo = new Date(`${data}T00:00:00Z`);
      if (reset.hoje.getTime() <= alvo.getTime()) break;
      const escorregou = await prisma.monthlyEntry.count({ where: { ...dono, category: "EXPENSE", parentCategory: { in: ["LAZER", "OUTROS"] }, entryDate: { gte: alvo, lt: new Date(alvo.getTime() + 86_400_000) } } });
      feita = escorregou === 0;
      break;
    }
    case 18:
      feita = (await decisaoDesde(["ritual"])) > 0;
      break;
  }
  if (feita) await marcarDiaFeito(ctx, dia);
  return feita;
}
