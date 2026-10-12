import { mesesAteMeta } from "./posso-comprar";
import { nivelDaCategoria } from "@/lib/planning/remanejo";

/**
 * Os caminhos guiados do Decidir (protótipo r65): "Como guardar mais?" e "Quando chego na minha
 * meta?". Aqui só as contas; a tela mora em components/decisoes/.
 */

/**
 * Quanto dá para apertar em cada categoria (protótipo, "Onde dá para apertar?"): desejos primeiro
 * (Lazer 40%, Compras e as criadas não essenciais 25%), depois o dia a dia (Transporte 10%,
 * Alimentação 15%, que começa desligada). Moradia, saúde, educação e impostos nunca entram.
 */
const CORTE: Record<string, number> = { LAZER: 0.4, OUTROS: 0.25, TRANSPORTE: 0.1, ALIMENTACAO: 0.15 };
const CORTE_DESEJO_CRIADA = 0.25;

export type Aperto = { key: string; label: string; planejado: number; corte: number; depois: number; ligadoDeInicio: boolean; nivel: 1 | 2 };

export function apertos(categorias: { key: string; label: string; planejado: number; essencial?: boolean }[]): Aperto[] {
  return categorias
    .filter((c) => c.planejado > 0)
    .flatMap((c) => {
      const nivel = nivelDaCategoria(c);
      if (nivel === null) return [];
      const taxa = CORTE[c.key] ?? (nivel === 1 ? CORTE_DESEJO_CRIADA : 0);
      if (!taxa) return [];
      const corte = Math.round(c.planejado * taxa);
      if (corte < 10) return [];
      return [{ key: c.key, label: c.label, planejado: c.planejado, corte, depois: c.planejado - corte, ligadoDeInicio: c.key !== "ALIMENTACAO", nivel }];
    })
    .sort((a, b) => a.nivel - b.nivel || b.corte - a.corte);
}

/** Em quantos meses a meta chega guardando `porMes` (null = não chega). A mesma conta das Metas. */
export function mesesParaChegar(meta: { atual: number; alvo: number; taxaMensal: number }, porMes: number): number | null {
  if (meta.atual >= meta.alvo) return 0;
  if (!(porMes > 0)) return null;
  return mesesAteMeta({ atual: meta.atual, alvo: meta.alvo, taxa: meta.taxaMensal }, () => porMes);
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "Março de 2028" / "mar/2028", contando k meses a partir do mês de agora. */
export function mesDaqui(k: number, hoje: { ano: number; mes: number }, curto = false): string {
  const d = new Date(hoje.ano, hoje.mes - 1 + k, 1);
  if (curto) return `${CURTOS[d.getMonth()]}/${d.getFullYear()}`;
  const n = MESES[d.getMonth()];
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} de ${d.getFullYear()}`;
}
