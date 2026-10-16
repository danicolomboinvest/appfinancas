import { computeGoalPlan } from "@/lib/planning/goal";
import { arredondarPorMes } from "@/lib/planning/meses-do-prazo";

/**
 * As contas da área Metas da versão nova (protótipo aprovado, rota #metas e o detalhe "painel com
 * projeção"). Uma conta só para o app todo (ana-canonica.md, seção 3):
 *
 * - Por mês necessário: o PMT do motor de sempre (`computeGoalPlan`), com `ceil`.
 * - Atrasada: abaixo de 85% do esperado pelo tempo, e só depois de 30 dias (o mesmo motor).
 * - Chegada: pelo RITMO, a média dos 3 últimos meses fechados desde o início da meta, rendendo
 *   como a meta. Sem ritmo, pelo valor por mês combinado.
 * - Próxima a chegar: a de chegada mais cedo por essa conta (nunca a atrasada só pelo prazo).
 *
 * Tudo puro, sem banco: a tela e os testes chamam as mesmas funções.
 */

/** Rendimento das metas quando a pessoa não diz outro (canônica: 10% ao ano). */
export const TAXA_PADRAO_DAS_METAS = 0.1;

export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-09". Mês de 1 a 12. */
export const chaveDoMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;

export type AportesPorMes = ReadonlyMap<string, number>;

const somaDoMes = (aportes: AportesPorMes, chave: string) => aportes.get(chave) ?? 0;

/** Os meses da meta, do mês em que ela nasceu até o mês de hoje (inclusive). */
export function mesesDaMeta(inicio: Date, hoje: Date): { chave: string; ano: number; mes: number }[] {
  const lista: { chave: string; ano: number; mes: number }[] = [];
  let ano = inicio.getFullYear();
  let mes = inicio.getMonth() + 1;
  const fimAno = hoje.getFullYear();
  const fimMes = hoje.getMonth() + 1;
  while (ano < fimAno || (ano === fimAno && mes <= fimMes)) {
    lista.push({ chave: chaveDoMes(ano, mes), ano, mes });
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  if (lista.length === 0) lista.push({ chave: chaveDoMes(fimAno, fimMes), ano: fimAno, mes: fimMes });
  return lista;
}

/**
 * O ritmo: a média do que entrou na meta nos 3 últimos meses FECHADOS desde o início dela. Mês
 * com resgate conta o líquido. Meta com menos de 3 meses fechados usa os que tem; sem nenhum, 0.
 */
export function ritmoDaMeta(aportes: AportesPorMes, inicio: Date, hoje: Date): number {
  const fechados = mesesDaMeta(inicio, hoje).slice(0, -1).slice(-3);
  if (fechados.length === 0) return 0;
  const media = fechados.reduce((t, m) => t + somaDoMes(aportes, m.chave), 0) / fechados.length;
  return Math.max(0, media);
}

/**
 * Quantos meses (a contar do mês de hoje) até o saldo passar do alvo, guardando `porMes` no
 * começo de cada mês e rendendo `taxaAnual`. 0 = já chegou; null = nunca (nada por mês, ou
 * mais de 60 anos).
 */
export function mesesAteChegar(guardado: number, alvo: number, porMes: number, taxaAnual: number): number | null {
  if (guardado >= alvo) return 0;
  if (!(porMes > 0)) return null;
  const r = Math.pow(1 + Math.max(taxaAnual, 0), 1 / 12) - 1;
  let saldo = guardado;
  let n = 0;
  while (saldo < alvo && n < 720) {
    saldo = (saldo + porMes) * (1 + r);
    n += 1;
  }
  return n < 720 ? n : null;
}

/** O mês que fica `n` meses depois do mês de hoje: "mai/2032" e "mai/32". */
export function mesDaqui(hoje: Date, n: number): { mes: number; ano: number; texto: string; curto: string; longo: string } {
  const i = hoje.getMonth() + n;
  const ano = hoje.getFullYear() + Math.floor(i / 12);
  const mes = ((i % 12) + 12) % 12;
  return {
    mes: mes + 1,
    ano,
    texto: `${MESES_CURTOS[mes]}/${ano}`,
    curto: `${MESES_CURTOS[mes]}/${String(ano).slice(2)}`,
    longo: `${MESES_LONGOS[mes].charAt(0).toUpperCase()}${MESES_LONGOS[mes].slice(1)} de ${ano}`,
  };
}

/** Meses inteiros entre o mês de hoje e o mês da data (0 se a data é deste mês ou já passou). */
export function mesesAteOMes(hoje: Date, data: Date): number {
  return Math.max(0, (data.getUTCFullYear() - hoje.getFullYear()) * 12 + data.getUTCMonth() - hoje.getMonth());
}

/** "1 ano e 1 mês", "4 anos e 6 meses", "3 meses". */
export function duracao(meses: number): string {
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  const partes = [a ? `${a} ${a === 1 ? "ano" : "anos"}` : "", m ? `${m} ${m === 1 ? "mês" : "meses"}` : ""].filter(Boolean);
  return partes.join(" e ") || "menos de 1 mês";
}

export type StatusDaMeta = "ON_TRACK" | "BEHIND" | "ACHIEVED" | "SEM_PRAZO";

export type EntradaDaMeta = {
  alvo: number;
  guardado: number;
  /** Nulo = sem prazo. */
  prazo: Date | null;
  taxaAnual: number;
  inicio: Date;
  /** O valor por mês combinado (o que ela escolheu ao criar, ou o "Guardar R$ X por mês"). */
  porMesCombinado: number;
  /** Quanto entrou na meta em cada mês ("2026-09" → 900). */
  aportes: AportesPorMes;
  hoje: Date;
};

export type PlanoDaMeta = {
  status: StatusDaMeta;
  /** Meses até o prazo (o mesmo arredondamento do motor); nulo sem prazo. */
  mesesAtePrazo: number | null;
  /** Por mês para chegar no prazo, de R$ 10 em R$ 10 (a mesma conta da folha). Sem prazo, o combinado. */
  porMesNecessario: number;
  /** Quanto devia ter pelo tempo que passou (~). Nulo sem prazo. */
  esperado: number | null;
  /** Quanto está atrás do esperado (só quando atrasada). */
  atras: number | null;
  pct: number;
  ritmo: number;
  /** Meses até chegar pelo ritmo (ou, sem ritmo, pelo combinado). */
  chega: number | null;
  /** Se a chegada foi calculada pelo ritmo (true) ou pelo combinado (false). */
  chegaPeloRitmo: boolean;
  /** A chegada pelo ritmo passa do prazo. */
  tarde: boolean;
  /** Meta sem nenhum aporte e com menos de 30 dias: selo "Nova". */
  nova: boolean;
};

const DIA = 86_400_000;

export function planoDaMeta(e: EntradaDaMeta): PlanoDaMeta {
  const pct = e.alvo > 0 ? Math.round((e.guardado / e.alvo) * 100) : 0;
  const ritmo = ritmoDaMeta(e.aportes, e.inicio, e.hoje);
  const temAporte = [...e.aportes.values()].some((v) => v !== 0);
  const nova = !temAporte && e.hoje.getTime() - e.inicio.getTime() < 30 * DIA;
  const chegaRitmo = mesesAteChegar(e.guardado, e.alvo, ritmo, e.taxaAnual);
  const chegaCombinado = mesesAteChegar(e.guardado, e.alvo, e.porMesCombinado, e.taxaAnual);
  const chegaPeloRitmo = chegaRitmo !== null && ritmo > 0;
  const chega = chegaPeloRitmo ? chegaRitmo : e.guardado >= e.alvo ? 0 : chegaCombinado;

  if (!e.prazo) {
    return {
      status: e.guardado >= e.alvo ? "ACHIEVED" : "SEM_PRAZO",
      mesesAtePrazo: null,
      porMesNecessario: Math.ceil(e.porMesCombinado),
      esperado: null,
      atras: null,
      pct,
      ritmo,
      chega,
      chegaPeloRitmo,
      tarde: false,
      nova,
    };
  }

  const motor = computeGoalPlan({ targetAmount: e.alvo, currentAmount: e.guardado, targetDate: e.prazo, annualRate: e.taxaAnual, now: e.hoje, startedAt: e.inicio });
  const status: StatusDaMeta = motor.status === "ACHIEVED" ? "ACHIEVED" : motor.status === "BEHIND" ? "BEHIND" : "ON_TRACK";
  const esperado = motor.timeElapsed !== null ? e.alvo * motor.timeElapsed : null;
  const prazoN = mesesAteOMes(e.hoje, e.prazo);
  return {
    status,
    mesesAtePrazo: motor.monthsRemaining,
    // A mesma conta de todas as telas (lib/planning/meses-do-prazo.ts): de R$ 10 em R$ 10.
    porMesNecessario: arredondarPorMes(motor.requiredMonthlyContribution),
    esperado,
    atras: status === "BEHIND" && esperado !== null ? Math.max(0, Math.round(esperado - e.guardado)) : null,
    pct,
    ritmo,
    chega,
    chegaPeloRitmo,
    tarde: chegaPeloRitmo && chega !== null && chega > prazoN,
    nova,
  };
}

/**
 * Qual meta chega primeiro: a de chegada mais cedo pelo ritmo (sem ritmo, pelo combinado). As
 * concluídas, as que nunca chegam e as de prazo apertado ficam de fora. Nula quando nenhuma tem chegada.
 */
export function proximaAChegar<T extends { plano: PlanoDaMeta }>(metas: T[], apertada: (m: T) => boolean = () => false): T | null {
  // Meta de prazo apertado não é "próxima a chegar" (15/10/2026): sem ritmo, a chegada dela vem de
  // um "por mês" que não cabe, e o app dizia "chega primeiro" e "prazo apertado" da mesma meta.
  const candidatas = metas.filter((m) => m.plano.status !== "ACHIEVED" && m.plano.chega !== null && !apertada(m));
  if (candidatas.length === 0) return null;
  return candidatas.reduce((a, b) => ((b.plano.chega ?? Infinity) < (a.plano.chega ?? Infinity) ? b : a));
}

/** O mês do aporte que o cartão pergunta: até o dia 7, o mês passado; depois, o mês de hoje. */
export function mesDoAporte(hoje: Date): { ano: number; mes: number; chave: string; nome: string; doMesPassado: boolean } {
  const doMesPassado = hoje.getDate() <= 7;
  const ref = doMesPassado ? new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1) : hoje;
  const ano = ref.getFullYear();
  const mes = ref.getMonth() + 1;
  return { ano, mes, chave: chaveDoMes(ano, mes), nome: MESES_LONGOS[mes - 1], doMesPassado };
}

/** Cada bolinha do "Mês a mês": guardou tudo (95% do combinado ou mais), parte, nada, ou o mês de agora. */
export type SituacaoDoMes = "tudo" | "parte" | "nada" | "atual";

export function situacaoDoMes(valor: number, combinado: number, ehAtual: boolean): SituacaoDoMes {
  if (ehAtual) return "atual";
  if (valor > 0 && combinado > 0 && valor >= combinado * 0.95) return "tudo";
  if (valor > 0) return combinado > 0 ? "parte" : "tudo";
  return "nada";
}

/** O "guardar R$ X por mês" da nova meta: o PMT com rendimento, arredondado para cima de 10 em 10. */
export function porMesDaNovaMeta(alvo: number, prazo: Date, hoje: Date, taxaAnual = TAXA_PADRAO_DAS_METAS, guardado = 0): number {
  const motor = computeGoalPlan({ targetAmount: alvo, currentAmount: guardado, targetDate: prazo, annualRate: taxaAnual, now: hoje });
  return arredondarPorMes(motor.requiredMonthlyContribution);
}
