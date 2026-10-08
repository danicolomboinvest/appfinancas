import type { Ritmo } from "../ritmo";

/**
 * Onde o convite pro fechamento do mês aparece na aba Foco:
 * - "destaque": o card grande no topo (quem acompanha por mês);
 * - "discreto": a linha mais abaixo (quem acompanha por semana, só na primeira quinzena);
 * - null: não aparece (já fechou, ou o mês anterior não teve orçamento montado enquanto corria:
 *   quem chegou agora e importou o extrato do mês passado não planejou aquele mês).
 *
 * Quem nunca respondeu a pergunta do ritmo (ritmo null) conta como MENSAL. Antes as duas
 * condições exigiam um ritmo escolhido, e a iniciante que pulou a pergunta nunca via o
 * fechamento, justo quem mais precisa dele. E é pra lá que o botão do resumo por e-mail leva.
 */
export function ondeMostrarFechamento(p: {
  ritmo: Ritmo | null;
  fechamentoFeito: boolean;
  mesAnteriorTinhaPlano: boolean;
  /** Dia do mês de hoje (1–31). */
  dia: number;
}): "destaque" | "discreto" | null {
  if (p.fechamentoFeito || !p.mesAnteriorTinhaPlano) return null;
  if (p.ritmo === "semanal") return p.dia <= 15 ? "discreto" : null;
  return "destaque";
}
