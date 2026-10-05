/**
 * Em que pé está o Money Reset da pessoa (05/10/2026). Regras do protótipo aprovado:
 *  - o Dia 0 (separar o que vai precisar) vem antes de tudo, e o dia 1 abre no dia seguinte;
 *  - uma missão por dia: a seguinte abre no dia de calendário depois que a anterior foi feita;
 *  - pulou um dia? A missão espera: continua de onde parou, sem perder nada.
 *
 * Datas são dias de calendário de Brasília em UTC meia-noite (ver lib/contas/contas.ts). Puro.
 */

import { diasAte } from "@/lib/contas/contas";

export const TOTAL_DE_DIAS = 21;

export type StatusDoDia = "feita" | "hoje" | "amanha" | "bloqueada";

export type EstadoDoReset = {
  fase: "dia0" | "andamento" | "concluido";
  /** A próxima missão a fazer (null no Dia 0 e no fim). */
  atual: number | null;
  /** A missão atual já pode ser feita hoje? (false = abre amanhã). */
  disponivel: boolean;
  feitas: number;
  status: Record<number, StatusDoDia>;
};

export function estadoDoReset({ inicio, feitas, hoje }: { inicio: Date | null; feitas: Map<number, Date>; hoje: Date }): EstadoDoReset {
  const status: Record<number, StatusDoDia> = {};
  for (let d = 1; d <= TOTAL_DE_DIAS; d++) status[d] = feitas.has(d) ? "feita" : "bloqueada";
  if (!inicio) return { fase: "dia0", atual: null, disponivel: false, feitas: 0, status };

  let atual: number | null = null;
  for (let d = 1; d <= TOTAL_DE_DIAS; d++) {
    if (!feitas.has(d)) {
      atual = d;
      break;
    }
  }
  if (atual === null) return { fase: "concluido", atual: null, disponivel: false, feitas: TOTAL_DE_DIAS, status };

  // A anterior feita (ou o Dia 0, para o dia 1): a atual abre no dia seguinte a ela.
  const desde = atual === 1 ? inicio : (feitas.get(atual - 1) ?? inicio);
  const disponivel = diasAte(hoje, desde) >= 1;
  status[atual] = disponivel ? "hoje" : "amanha";
  return { fase: "andamento", atual, disponivel, feitas: feitas.size, status };
}

/** A partir de quando o que ela fez conta para a missão (o dia em que a missão abriu). */
export function abriuEm({ dia, inicio, feitas }: { dia: number; inicio: Date; feitas: Map<number, Date> }): Date {
  const anterior = dia === 1 ? inicio : (feitas.get(dia - 1) ?? inicio);
  return new Date(anterior.getTime() + 86_400_000);
}
