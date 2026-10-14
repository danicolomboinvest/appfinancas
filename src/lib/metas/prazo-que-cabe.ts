import { MESES_CURTOS, mesesAteChegar, porMesDaNovaMeta } from "@/lib/metas/projecao";

/**
 * Um prazo que cabe (14/10/2026). Uma cliente criou a meta "Casa" de R$ 2.000.000 para out/2029:
 * R$ 47.810 por mês com renda de uns R$ 5.970. A Dani: "uma casa é normal ser dois milhões; a
 * pessoa precisa colocar um prazo [que caiba]". O valor fica; o app sugere o prazo.
 *
 * A regra do limite (quanto cabe guardar por mês para as metas):
 * 1. com renda conhecida (a do plano do mês ou, sem ela, a média dos 12 meses fechados): o MAIOR
 *    entre o "quanto guardar" do plano do mês e 20% da renda. Um "quanto guardar" baixo ou
 *    esquecido no plano não acende o aviso numa meta que pede 15% da renda;
 * 2. sem renda, o "quanto guardar" do plano, se houver;
 * 3. sem os dois, o que ela guarda de verdade (média dos aportes dos 12 meses fechados);
 * 4. sem nada disso, não há limite e nada aparece.
 *
 * O prazo fica apertado quando o "por mês" da meta passa desse limite. A sugestão é o primeiro
 * mês em que, guardando o limite (ou o valor que ela digitar), a meta chega, rendendo como a
 * meta rende. Nunca muda a meta sozinha: só sugere.
 */

/** Parte da renda que cabe nas metas quando o plano do mês não diz quanto guardar. */
export const PARTE_DA_RENDA_PARA_METAS = 0.2;

/** Último ano que o calendário da meta aceita (o mesmo do servidor). */
export const ULTIMO_ANO_DO_PRAZO = 2080;

export type FonteDoLimite = "plano" | "renda" | "aportes";

export type LimiteDasMetas = {
  /** Quanto cabe guardar por mês, arredondado para baixo de 50 em 50. */
  porMes: number;
  /** A renda de referência (plano ou média), ou null quando o limite veio dos aportes. */
  renda: number | null;
  fonte: FonteDoLimite;
};

const redondo = (v: number) => (v >= 100 ? Math.floor(v / 50) * 50 : Math.round(v));
const positivo = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export function limiteDasMetas(e: {
  /** O aporte pretendido no plano do mês. */
  planoGuardar?: number | null;
  /** A renda digitada no plano do mês. */
  planoRenda?: number | null;
  /** A média dos 12 meses fechados. */
  rendaMedia?: number | null;
  /** O que ela guardou por mês, em média, nos 12 meses fechados. */
  aporteMedio?: number | null;
}): LimiteDasMetas | null {
  const renda = positivo(e.planoRenda) ? e.planoRenda : positivo(e.rendaMedia) ? e.rendaMedia : null;
  const daRenda = renda !== null ? renda * PARTE_DA_RENDA_PARA_METAS : 0;
  if (positivo(e.planoGuardar) && e.planoGuardar >= daRenda) return { porMes: redondo(e.planoGuardar), renda, fonte: "plano" };
  if (renda !== null) return { porMes: redondo(daRenda), renda, fonte: "renda" };
  if (positivo(e.aporteMedio)) return { porMes: redondo(e.aporteMedio), renda: null, fonte: "aportes" };
  return null;
}

/** O "por mês" da meta passa do que cabe? Sem limite conhecido, nunca. */
export function prazoApertado(porMesDaMeta: number, limite: LimiteDasMetas | null): boolean {
  if (!limite || !(limite.porMes > 0)) return false;
  return porMesDaMeta > limite.porMes;
}

/** "mais que a sua renda", "mais do que o seu plano guarda"... */
export function motivoDoAperto(porMesDaMeta: number, limite: LimiteDasMetas): string {
  if (limite.renda !== null && porMesDaMeta >= limite.renda) return "mais que a sua renda";
  if (limite.fonte === "plano") return "mais do que o seu plano guarda";
  if (limite.fonte === "renda") return "mais que 20% da sua renda";
  return "mais do que você costuma guardar";
}

export type PrazoSugerido = {
  /** Meses a contar do mês de hoje. */
  meses: number;
  ano: number;
  /** 1 a 12. */
  mes: number;
  /** "mar/2054". */
  texto: string;
};

/**
 * O primeiro mês em que a meta chega guardando `porMes`, rendendo `taxaAnual`. Usa a MESMA conta
 * que o servidor usa para gravar o "por mês" da meta (`porMesDaNovaMeta`): com o prazo sugerido,
 * a meta pede `porMes` ou menos. Null quando não chega até 2080 (ou nada por mês).
 */
export function prazoQueCabe(e: { alvo: number; guardado: number; porMes: number; taxaAnual: number; hoje: Date }): PrazoSugerido | null {
  if (!(e.porMes > 0) || !(e.alvo > e.guardado)) return null;
  const estimativa = mesesAteChegar(e.guardado, e.alvo, e.porMes, e.taxaAnual);
  if (estimativa === null) return null;
  const hojeMi = e.hoje.getFullYear() * 12 + e.hoje.getMonth();
  const limite = ULTIMO_ANO_DO_PRAZO * 12 + 11 - hojeMi;
  // A estimativa e o motor arredondam diferente por um ou dois meses: acha o primeiro que fecha.
  for (let n = Math.max(1, estimativa - 3); n <= Math.min(limite, estimativa + 24); n++) {
    const i = hojeMi + n;
    const prazo = new Date(Math.floor(i / 12), i % 12, 1, 12);
    if (porMesDaNovaMeta(e.alvo, prazo, e.hoje, e.taxaAnual, e.guardado) <= e.porMes) {
      const ano = Math.floor(i / 12);
      const mes = (i % 12) + 1;
      return { meses: n, ano, mes, texto: `${MESES_CURTOS[mes - 1]}/${ano}` };
    }
  }
  return null;
}
