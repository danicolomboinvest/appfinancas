/**
 * De onde tirar quando uma categoria passa do plano (regra 3.1, rodadas 38 e 53, decisão da
 * dona em 10/10/2026). Uma regra só para o Orçamento, o Resumo e, depois, o Decidir e o Casal.
 *
 * 1. Primeiro o que é desejo: Lazer, Outros (e Compras, Restaurantes, Assinaturas, Beleza,
 *    Viagens e Presentes quando existirem) e toda categoria criada pela pessoa que NÃO esteja
 *    marcada "É essencial".
 * 2. Só se o desejo não cobrir: o dia a dia (Transporte e Alimentação), com a etiqueta
 *    "é do dia a dia". Nesse caso o botão principal vira "Usar o livre do mês".
 * 3. Nunca: Moradia, Saúde, Educação e Impostos (a mesma lista FORA do Raio-X).
 *
 * Dentro do nível, a de maior folga primeiro; no máximo duas, a primeira inteira e o resto da
 * segunda. O total do plano do mês não muda: só as duas linhas trocam valor.
 *
 * Puro, sem banco: a tela manda as categorias do mês e recebe a sugestão.
 */
export const NUNCA_SUGERIR = new Set(["MORADIA", "SAUDE", "EDUCACAO", "IMPOSTOS"]);
export const DO_DIA_A_DIA = new Set(["TRANSPORTE", "ALIMENTACAO"]);
const MAES = new Set(["MORADIA", "ALIMENTACAO", "TRANSPORTE", "SAUDE", "LAZER", "EDUCACAO", "OUTROS", "IMPOSTOS"]);

export type CategoriaParaRemanejo = {
  key: string;
  label: string;
  planejado: number;
  gasto: number;
  /** Só para categoria criada pela pessoa: marcada "É essencial" nunca é origem. */
  essencial?: boolean;
};

export type Nivel = 1 | 2;

/** 1 = desejo, 2 = dia a dia, null = nunca sugerir. */
export function nivelDaCategoria(c: Pick<CategoriaParaRemanejo, "key" | "essencial">): Nivel | null {
  if (MAES.has(c.key)) {
    if (NUNCA_SUGERIR.has(c.key)) return null;
    return DO_DIA_A_DIA.has(c.key) ? 2 : 1;
  }
  return c.essencial ? null : 1;
}

/** O que ainda está livre no plano da categoria neste mês (nunca negativo). */
export function folgaDe(c: Pick<CategoriaParaRemanejo, "planejado" | "gasto">): number {
  return Math.max(0, Math.floor(c.planejado - c.gasto));
}

/** Quanto passou do plano, arredondado para cima (R$ 66,40 vira R$ 67). */
export function quantoPassou(c: Pick<CategoriaParaRemanejo, "planejado" | "gasto">): number {
  return Math.max(0, Math.ceil(c.gasto - c.planejado - 1e-9));
}

export type Origem = { key: string; label: string; valor: number; folga: number; sobraDepois: number };

export type PlanoDeCobrir = {
  valor: number;
  /** De qual nível saiu a sugestão; null = nada cobre (só "Usar o livre" e "Deixar assim"). */
  nivel: Nivel | null;
  origens: Origem[];
  /** Botão principal: tirar das categorias (nível 1) ou usar o livre do mês (nível 2 ou nada). */
  principal: "tirar" | "livre";
};

function cobrirCom(lista: CategoriaParaRemanejo[], valor: number): Origem[] | null {
  const ordem = lista
    .map((c) => ({ c, folga: folgaDe(c) }))
    .filter((x) => x.folga > 0)
    .sort((a, b) => b.folga - a.folga || a.c.label.localeCompare(b.c.label));
  if (ordem.length === 0) return null;
  const [a, b] = ordem;
  if (a.folga >= valor) return [{ key: a.c.key, label: a.c.label, valor, folga: a.folga, sobraDepois: a.folga - valor }];
  if (b && a.folga + b.folga >= valor) {
    const resto = valor - a.folga;
    return [
      { key: a.c.key, label: a.c.label, valor: a.folga, folga: a.folga, sobraDepois: 0 },
      { key: b.c.key, label: b.c.label, valor: resto, folga: b.folga, sobraDepois: b.folga - resto },
    ];
  }
  return null;
}

export function planoDeCobrir(passou: CategoriaParaRemanejo, categorias: CategoriaParaRemanejo[]): PlanoDeCobrir {
  const valor = quantoPassou(passou);
  const outras = categorias.filter((c) => c.key !== passou.key && c.planejado > 0);
  if (valor <= 0) return { valor: 0, nivel: null, origens: [], principal: "livre" };
  const nivel1 = cobrirCom(outras.filter((c) => nivelDaCategoria(c) === 1), valor);
  if (nivel1) return { valor, nivel: 1, origens: nivel1, principal: "tirar" };
  const nivel2 = cobrirCom(outras.filter((c) => nivelDaCategoria(c) === 2), valor);
  if (nivel2) return { valor, nivel: 2, origens: nivel2, principal: "livre" };
  return { valor, nivel: null, origens: [], principal: "livre" };
}

/**
 * "Usar o livre do mês": o que passou sai do livre que sobra; o novo por dia divide o resto
 * pelos dias que faltam (com hoje). Ana: livre R$ 3.241 − 67 = R$ 3.174 em 25 dias = R$ 127.
 */
export function porDiaComOLivre(livre: number, valor: number, diasRestantes: number): number {
  return Math.max(0, livre - valor) / Math.max(1, diasRestantes);
}

/**
 * "Rever o plano" só aparece quando a categoria passou de 110% do plano em 3 meses seguidos
 * (os 3 últimos fechados). A sugestão é a mediana do gasto nesses meses; nunca salva sozinha.
 */
export function revisaoDoPlano(fechados: { gasto: number; planejado: number }[]): { mediana: number } | null {
  const ultimos = fechados.slice(-3);
  if (ultimos.length < 3) return null;
  if (!ultimos.every((m) => m.planejado > 0 && m.gasto > m.planejado * 1.1)) return null;
  const ordenados = ultimos.map((m) => m.gasto).sort((a, b) => a - b);
  return { mediana: Math.ceil(ordenados[1] / 10) * 10 };
}

/**
 * "Cobrir com outra categoria" (protótipo, folha "O que fazer?"): até 4 categorias que cobrem
 * sozinhas o que passou, desejo antes do dia a dia e, dentro do nível, a de mais folga. Essencial
 * nunca entra. Vazio quando nenhuma cobre sozinha (aí vale o plano de duas origens, planoDeCobrir).
 */
export function fontesParaCobrir(passou: CategoriaParaRemanejo, categorias: CategoriaParaRemanejo[]): (Origem & { nivel: Nivel })[] {
  const valor = quantoPassou(passou);
  if (valor <= 0) return [];
  return categorias
    .filter((c) => c.key !== passou.key && c.planejado > 0)
    .map((c) => ({ c, nivel: nivelDaCategoria(c), folga: folgaDe(c) }))
    .filter((x): x is { c: CategoriaParaRemanejo; nivel: Nivel; folga: number } => x.nivel !== null && x.folga >= valor)
    .sort((a, b) => a.nivel - b.nivel || b.folga - a.folga || a.c.label.localeCompare(b.c.label))
    .slice(0, 4)
    .map((x) => ({ key: x.c.key, label: x.c.label, valor, folga: x.folga, sobraDepois: x.folga - valor, nivel: x.nivel }));
}
