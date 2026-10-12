/**
 * Em que pé está o Money Reset da pessoa, na versão A+B (12/10/2026). Regras da proposta aprovada:
 *  - sem Dia 0: a missão 1 abre no dia da compra;
 *  - a próxima missão abre assim que a anterior termina ("o ideal é amanhã, mas dá para seguir");
 *  - pulou dias? A missão espera: continua de onde parou, sem perder nada.
 *
 * Quem já estava no meio não perde nada (`marcosFeitos`): os registros antigos ("reset|dia|N")
 * continuam no banco e são traduzidos pela tabela dia antigo → marco novo. Nada é apagado, então
 * dá para voltar atrás.
 *
 * Puro, sem banco.
 */

import { MARCO_DO_DIA_ANTIGO, MARCOS, TOTAL_DE_MARCOS } from "./missoes";

export { TOTAL_DE_MARCOS };

export type StatusDoMarco = "feito" | "agora" | "fechado";

export type EstadoDoReset = {
  fase: "andamento" | "concluido";
  /** A próxima missão a fazer (null no fim). */
  atual: number | null;
  /** Quantos marcos estão feitos. */
  feitos: number;
  /** A semana em que a pessoa está (no fim, a 3). As seguintes ficam na névoa. */
  semana: 1 | 2 | 3;
  status: Record<number, StatusDoMarco>;
};

/**
 * Os marcos feitos, juntando o registro novo ("reset|marco|N") com a tradução dos dias antigos
 * ("reset|dia|N"). Quando dois dias antigos viram o mesmo marco (o 1 e o 3 viram o marco 1), vale
 * o primeiro que foi feito. A data é a do registro: é dela que o marco seguinte conta.
 */
export function marcosFeitos({ marcos, diasAntigos }: { marcos: Map<number, Date>; diasAntigos: Map<number, Date> }): Map<number, Date> {
  const out = new Map<number, Date>();
  const guardar = (n: number, quando: Date) => {
    if (n < 1 || n > TOTAL_DE_MARCOS) return;
    const ja = out.get(n);
    if (!ja || quando.getTime() < ja.getTime()) out.set(n, quando);
  };
  for (const [dia, quando] of diasAntigos) {
    const n = MARCO_DO_DIA_ANTIGO[dia];
    if (n) guardar(n, quando);
  }
  for (const [n, quando] of marcos) guardar(n, quando);
  return out;
}

export function estadoDoReset(feitos: Map<number, Date>): EstadoDoReset {
  const status: Record<number, StatusDoMarco> = {};
  let atual: number | null = null;
  for (let n = 1; n <= TOTAL_DE_MARCOS; n++) {
    if (feitos.has(n)) status[n] = "feito";
    else if (atual === null) {
      atual = n;
      status[n] = "agora";
    } else status[n] = "fechado";
  }
  const total = [...feitos.keys()].filter((n) => n >= 1 && n <= TOTAL_DE_MARCOS).length;
  if (atual === null) return { fase: "concluido", atual: null, feitos: total, semana: 3, status };
  const semana = MARCOS.find((m) => m.n === atual)!.semana;
  return { fase: "andamento", atual, feitos: total, semana, status };
}

/**
 * A partir de quando o que ela fez conta para o marco: o momento em que o anterior foi feito (é
 * quando este abriu). O marco 1 vale para qualquer data.
 */
export function abriuEm(n: number, feitos: Map<number, Date>): Date {
  return n <= 1 ? new Date(0) : (feitos.get(n - 1) ?? new Date(0));
}

/** O ideal é um por dia: o marco foi feito hoje (no dia de Brasília)? Muda a frase, não trava. */
export function feitoHoje(quando: Date | undefined, agora: Date): boolean {
  if (!quando) return false;
  const dia = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  return dia(quando) === dia(agora);
}

export type EscolhaQueAcha = { tipo: string; valorAnual: number };

/**
 * O placar "Achei R$ X por mês": o que ela decidiu cortar no Raio-X (cortar = tudo, metade = metade,
 * já gravado por ano na decisão) mais o que ela disse que baixou na conta negociada. Só número dela:
 * sem decisão, é zero. Nunca negativo.
 */
export function acheiPorMes({ raiox, negociado }: { raiox: EscolhaQueAcha[]; negociado: number | null }): number {
  const doRaioX = raiox.filter((r) => r.tipo === "raiox_cancelar" || r.tipo === "raiox_metade").reduce((s, r) => s + Math.max(0, r.valorAnual), 0) / 12;
  return Math.max(0, doRaioX + Math.max(0, negociado ?? 0));
}
