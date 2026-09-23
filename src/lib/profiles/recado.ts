/**
 * O "Recado de hoje" do Disciplina: o que separa um coach de um bloco de frases motivacionais.
 *
 * Cada recado é disparado por uma condição REAL nos números — não é sorteio. A regra que a
 * Dani escreveu, e que este arquivo cumpre à risca: a cobrança ataca a DECISÃO, nunca a
 * pessoa. Todo recado cita um número e um prazo; nenhum usa adjetivo sobre quem está lendo.
 *
 * E ele sabe calar a boca: mês em que a renda despencou não é hora de cobrar disciplina. Se a
 * renda caiu 40% ou mais em relação ao mês passado, não há recado nenhum — silêncio é melhor
 * que soar cruel com quem está passando aperto.
 *
 * Puro e sem banco, porque é a lógica que precisa de teste.
 */

import type { Money } from "./voice";

export type DadosDoRecado = {
  /** Orçamento por categoria neste mês. Só as que têm plano. */
  categorias: { label: string; planejado: number; gasto: number }[];
  /** Fração do mês já decorrida (0–1). */
  mesDecorrido: number;
  diasRestantes: number;
  /** Quantos meses seguidos, ANTES deste, fecharam com aporte ou sobra maior que zero. */
  mesesSeguidosGuardando: number;
  /** Metas abertas com prazo: nome e quanto falta. */
  metas: { nome: string; faltam: number }[];
  gastoDoMes: number;
  gastoDoMesAnterior: number;
  rendaDoMes: number;
  rendaDoMesAnterior: number;
  /** Total planejado pro mês (soma dos orçamentos) e quanto já foi. */
  planejadoDoMes: number;
  mesFechado: boolean;
  money: Money;
};

export type Recado = {
  titulo: string;
  linha1: string;
  linha2: string;
  tom: "cobranca" | "elogio" | "alerta";
};

export function recadoDeHoje(d: DadosDoRecado): Recado | null {
  // Silêncio: renda despencou. Não é hora de cobrar nada.
  if (d.rendaDoMesAnterior > 0 && d.rendaDoMes > 0 && d.rendaDoMes < d.rendaDoMesAnterior * 0.6) return null;

  const m = (n: number) => d.money(Math.abs(n), { round: true });

  // 1. Uma categoria passou de 70% do orçamento antes de 70% do mês.
  if (!d.mesFechado && d.mesDecorrido < 0.7) {
    const estourando = d.categorias
      .filter((c) => c.planejado > 0 && c.gasto / c.planejado >= 0.7)
      .sort((a, b) => b.gasto / b.planejado - a.gasto / a.planejado)[0];
    if (estourando) {
      const pct = Math.round((estourando.gasto / estourando.planejado) * 100);
      return {
        titulo: "Recado de hoje ⚡",
        linha1: `Você já gastou ${pct}% do orçamento de ${estourando.label.toLowerCase()} e ainda faltam ${d.diasRestantes} dias.`,
        linha2: "A conta não fecha sozinha. Bora segurar essa categoria até o fim do mês.",
        tom: "cobranca",
      };
    }
  }

  // 2. Mês fechado gastando menos que o anterior: elogio, com o número.
  if (d.mesFechado && d.gastoDoMesAnterior > 0 && d.gastoDoMes < d.gastoDoMesAnterior) {
    return {
      titulo: "Isso é evolução 📈",
      linha1: `${m(d.gastoDoMesAnterior - d.gastoDoMes)} a menos que no mês passado.`,
      linha2: "Isso é EVOLUÇÃO. Bora repetir no próximo.",
      tom: "elogio",
    };
  }

  // 3. Três ou mais meses seguidos guardando.
  if (d.mesesSeguidosGuardando >= 3) {
    return {
      titulo: "Recado de hoje 🔥",
      linha1: `Você está há ${d.mesesSeguidosGuardando} meses guardando dinheiro sem falhar.`,
      linha2: "Disciplina já aparece nos números. Bora pro próximo mês.",
      tom: "elogio",
    };
  }

  const gastandoAdiantado = !d.mesFechado && d.planejadoDoMes > 0 && d.gastoDoMes / d.planejadoDoMes > d.mesDecorrido + 0.05;

  // 4. Tem meta com prazo e o gasto está acima do ritmo: cada compra compete com ela.
  const meta = d.metas.find((g) => g.faltam > 0);
  if (gastandoAdiantado && meta) {
    return {
      titulo: `Você disse que quer ${meta.nome.toLowerCase()} ✈️`,
      linha1: `Faltam ${m(meta.faltam)} para sua meta.`,
      linha2: "Cada compra agora compete com a meta. Bora escolher.",
      tom: "cobranca",
    };
  }

  // 5. Acima do ritmo, com dias suficientes pra corrigir.
  if (gastandoAdiantado && d.diasRestantes >= 5) {
    const faltam = Math.max(0, d.planejadoDoMes * d.mesDecorrido - d.gastoDoMes);
    return {
      titulo: "⚠️ Você está saindo do plano",
      linha1: "Ainda dá tempo. Bora corrigir hoje.",
      linha2: faltam > 0 ? `Faltam ${d.diasRestantes} dias e ${m(faltam)} do que você planejou.` : `Faltam ${d.diasRestantes} dias para o fim do mês.`,
      tom: "alerta",
    };
  }

  return null;
}
