import type { FocoLivre } from "@/lib/decisoes/foco";
import { diaDaSemana, previsaoDoMes, ritmoDoMes } from "@/lib/decisoes/foco-semana";
import type { Ritmo } from "@/lib/profiles/voice-base";

/**
 * Os números do widget do iPhone (11/10/2026), a partir do MESMO livre que o Resumo mostra
 * (montarFoco). Puro: a rota só carrega e entrega. O widget não faz conta nenhuma, só desenha;
 * assim o número da tela inicial nunca discorda do número do app.
 *
 * As frases vêm prontas e curtas (o widget é pequeno), sem travessão e sem sinal solto: o fim do
 * mês diz "sobra" ou "falta" com o valor positivo.
 */

export type MetaDoWidget = { id: string; nome: string; atual: number; alvo: number; pct: number };

export type NumerosDoWidget = {
  versao: 1;
  atualizadoEm: string;
  moeda: string;
  tema: string;
  /** O modo que ela escolheu no app: "claro", "escuro" ou "auto" (segue o iPhone). */
  modo: "claro" | "escuro" | "auto";
  livre: {
    tipo: "semana" | "mes" | "estimativa" | "semOrcamento";
    /** Nulo sem orçamento: o widget convida a montar o plano. */
    valor: number | null;
    rotulo: string;
    porDia: number | null;
    rotuloPorDia: string;
    /** Segunda = 0 … domingo = 6. */
    hoje: number;
    ritmo: Ritmo;
    /**
     * A semana fixa (regra A, 13/10/2026): o valor da semana, quanto já saiu e quanto passou.
     * Campo novo: o widget antigo ignora e segue lendo `valor` e `rotulo`, que já vêm certos.
     */
    semana?: { valor: number; gasto: number; passou: number; proxima: number | null };
  };
  fimDoMes: {
    /** Sempre positivo; a palavra diz se sobra ou falta. Nulo nos primeiros dias do mês. */
    valor: number | null;
    palavra: "sobra" | "falta" | null;
    rotulo: string;
  };
  metas: MetaDoWidget[];
};

export function numerosDoWidget(e: {
  livre: FocoLivre;
  agora: Date;
  /** "Agora" de verdade (instante), para o atualizadoEm. */
  instante: Date;
  moeda: string;
  tema: string;
  modo: "claro" | "escuro" | "auto";
  metas: { id: string; name: string; computedCurrentAmount: number; targetAmount: number | { toString(): string } }[];
}): NumerosDoWidget {
  const { indice } = diaDaSemana(e.agora);
  const l = e.livre;
  const metas = e.metas
    .map((g) => {
      const alvo = Number(g.targetAmount);
      const atual = Math.max(0, g.computedCurrentAmount);
      return { id: g.id, nome: g.name, atual: Math.round(atual), alvo: Math.round(alvo), pct: alvo > 0 ? Math.min(100, Math.floor((atual / alvo) * 100)) : 0 };
    })
    .slice(0, 12);
  const base = { versao: 1 as const, atualizadoEm: e.instante.toISOString(), moeda: e.moeda, tema: e.tema, modo: e.modo, metas };

  if (l.tipo === "semOrcamento") {
    return {
      ...base,
      livre: { tipo: "semOrcamento", valor: null, rotulo: "monte o seu plano no app", porDia: null, rotuloPorDia: "por dia", hoje: indice, ritmo: "dentro" },
      fimDoMes: { valor: null, palavra: null, rotulo: "no fim do mês" },
    };
  }

  // O mesmo número do Resumo (SemanaFoco): o que ainda cabe na semana fixa, ou quanto passou.
  const sem = l.semana;
  const passou = sem.passou >= 1;
  const previsao = l.tipo === "estimativa" ? null : previsaoDoMes(l.planoVariavel, l.gastoVariavel, l.decorrido, l.gastoUnico);
  const ritmo: Ritmo = passou ? "rapido" : l.tipo !== "estimativa" && l.planoVariavel > 0 ? ritmoDoMes(l.gastoVariavel / l.planoVariavel, l.decorrido) : "dentro";

  return {
    ...base,
    livre: {
      tipo: l.tipo,
      valor: Math.round(passou ? sem.passou : Math.max(0, sem.restante)),
      rotulo: passou ? "passou da semana" : "para gastar nesta semana",
      porDia: Math.round(sem.porDia),
      rotuloPorDia: sem.acabaNoDomingo ? "por dia até domingo" : `por dia até dia ${sem.fim}`,
      hoje: indice,
      ritmo,
      semana: { valor: Math.round(sem.valor), gasto: Math.round(sem.gasto), passou: Math.round(sem.passou), proxima: sem.proxima === null ? null : Math.round(sem.proxima) },
    },
    fimDoMes: {
      valor: previsao === null ? null : Math.abs(previsao),
      palavra: previsao === null ? null : previsao >= 0 ? "sobra" : "falta",
      rotulo: previsao === null ? "a previsão aparece depois dos primeiros dias" : previsao >= 0 ? "sobra no fim do mês" : "falta no fim do mês",
    },
  };
}
