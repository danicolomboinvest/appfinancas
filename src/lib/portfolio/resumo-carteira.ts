import { classificar, grupoDoAtivo, GRUPOS, NOME_DO_GRUPO, type AtivoParaClassificar, type Grupo } from "./classificacao";

/**
 * Os números da aba "Meus ativos" (rodadas 16 e 43): o total, o ganho desde a compra, Brasil e
 * Exterior, e o "Por tipo". Pura, para testar com a carteira da Ana.
 */
export type AtivoDoResumo = AtivoParaClassificar & {
  id: string;
  currentValue: number;
  investedValue: number | null;
  nativeCurrentValue: number | null;
  exchangeRate: number | null;
};

const c2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Onde o dinheiro está para o herói (Brasil × Exterior): a conta em que ele está (a moeda), a não
 * ser que ela tenha dito onde ele está. IVVB11 comprado na B3 fica no Brasil aqui, mas conta como
 * Exterior na Estratégia (é exposição lá fora); se ela escolher "Exterior" no ativo, vai para os
 * dois lugares.
 */
export function ondeNoHeroi(a: AtivoDoResumo): "brasil" | "exterior" {
  if (a.ondeEscolhido === "brasil" || a.ondeEscolhido === "exterior") return a.ondeEscolhido;
  return a.currency && a.currency !== "BRL" ? "exterior" : "brasil";
}

export type ResumoDaCarteira = {
  total: number;
  /** Atual − investido, só dos ativos com o investido preenchido. */
  ganho: number | null;
  /** O ganho sobre o investido (fração). */
  ganhoPct: number | null;
  brasil: number;
  /** O Exterior em reais. */
  exterior: number;
  /** O Exterior em dólar, quando dá para dizer (ativos na conta em dólar, ou o câmbio conhecido). */
  exteriorEmDolar: number | null;
  /** O câmbio usado (US$ 1 = R$ X), para o "?". */
  cambio: number | null;
  grupos: { grupo: Grupo; nome: string; valor: number; peso: number; ativos: string[]; emDolar: number; naB3: number }[];
};

export function resumirCarteira(ativos: AtivoDoResumo[]): ResumoDaCarteira {
  const total = c2(ativos.reduce((s, a) => s + a.currentValue, 0));
  const comInvestido = ativos.filter((a) => a.investedValue !== null && a.investedValue > 0);
  const investido = comInvestido.reduce((s, a) => s + (a.investedValue ?? 0), 0);
  const atualDosComInvestido = comInvestido.reduce((s, a) => s + a.currentValue, 0);
  const ganho = comInvestido.length > 0 ? c2(atualDosComInvestido - investido) : null;

  let brasil = 0;
  let exterior = 0;
  let dolar = 0;
  let cambio: number | null = null;
  let semDolar = 0;
  for (const a of ativos) {
    if (ondeNoHeroi(a) === "brasil") {
      brasil += a.currentValue;
      continue;
    }
    exterior += a.currentValue;
    if (a.currency === "USD" && a.nativeCurrentValue !== null) {
      dolar += a.nativeCurrentValue;
      if (!cambio && a.exchangeRate && a.exchangeRate > 0) cambio = a.exchangeRate;
    } else {
      semDolar += a.currentValue;
    }
  }
  // Ativo de fora guardado em reais (ela escolheu "Exterior"): entra no dólar pelo câmbio que o app já tem.
  const exteriorEmDolar = exterior <= 0 ? null : semDolar > 0 ? (cambio ? c2(dolar + semDolar / cambio) : null) : c2(dolar);

  const porGrupo = new Map<Grupo, AtivoDoResumo[]>();
  for (const a of ativos) {
    const g = grupoDoAtivo(a);
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), a]);
  }
  const grupos = GRUPOS.filter((g) => porGrupo.has(g))
    .map((g) => {
      const lista = porGrupo.get(g)!;
      const valor = c2(lista.reduce((s, a) => s + a.currentValue, 0));
      return {
        grupo: g,
        nome: NOME_DO_GRUPO[g],
        valor,
        peso: total > 0 ? valor / total : 0,
        ativos: [...lista].sort((x, y) => y.currentValue - x.currentValue).map((a) => a.id),
        emDolar: lista.filter((a) => a.currency && a.currency !== "BRL").length,
        naB3: lista.filter((a) => (!a.currency || a.currency === "BRL") && classificar(a).onde === "exterior").length,
      };
    })
    .sort((a, b) => b.valor - a.valor);

  return {
    total,
    ganho,
    ganhoPct: ganho !== null && investido > 0 ? ganho / investido : null,
    brasil: c2(brasil),
    exterior: c2(exterior),
    exteriorEmDolar,
    cambio,
    grupos,
  };
}

/** "16%": percentual sem casa decimal (rodada 55). */
export function pesoInteiro(fracao: number): string {
  return `${Math.round(fracao * 100)}%`;
}
