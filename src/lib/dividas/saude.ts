import { perfilDoTipo, retratoDe, taxaEstimadaDoTipo, type Divida, LIMIAR_DE_JURO_ALTO, LIMIAR_DE_SUPERENDIVIDAMENTO } from "@/lib/dividas/tipos";

/**
 * O que o SPI acrescenta ao motor do Rota (rodadas 9b e 32 do protótipo, 09–10/10/2026): a dívida
 * saudável. Regra do material 15 da Dani: "dívida saudável é planejada e não sobrecarrega as
 * finanças"; comparar os juros com a Selic.
 *
 * - Saudável: planejada E juros ao ano abaixo da Selic E em dia.
 * - Cara: juros altos (4% ao mês ou mais, o grupo 1 dela) OU atrasada.
 * - Atenção: as outras.
 *
 * As saudáveis seguem no ritmo delas: ficam fora da data do herói e do plano. O alerta de 30% da
 * renda conta todas, inclusive as saudáveis.
 */
export type Saude = "saudavel" | "atencao" | "cara";

export const PARA_QUE_FOI = ["Casa", "Carro", "Estudos", "Negócio", "Saúde", "Compras do dia a dia", "Emergência", "Cobrir outra dívida", "Outro"] as const;

/** A dívida como o SPI guarda: a do motor e o que o cadastro pergunta a mais. */
export type DividaDoSpi = Divida & {
  credor: string;
  apelido: string;
  paraQue: string | null;
  planejada: boolean;
  /** Parcelas que faltam e o total; null quando não tem parcela fixa. */
  parcelasAbertas: number | null;
  parcelasTotal: number | null;
  semParcela: boolean;
  diaVencimento: number | null;
};

/** Selic de reserva quando nenhuma taxa de referência foi cadastrada (o mesmo valor de exemplo do protótipo). */
export const SELIC_DE_RESERVA = 14.25;

/** Taxa ao mês (%) → ao ano (%), por juros compostos: (1 + m)^12 − 1. */
export function taxaAnual(mensal: number): number {
  return (Math.pow(1 + mensal / 100, 12) - 1) * 100;
}

export function saudeDe(d: Pick<Divida, "tipo" | "taxaMensal" | "atrasada"> & { planejada: boolean }, selicAno: number): Saude {
  // A mesma taxa do motor (taxaDe): a digitada, ou a estimada do tipo quando ela não sabe.
  const t = d.taxaMensal ?? taxaEstimadaDoTipo(d.tipo);
  if (t >= LIMIAR_DE_JURO_ALTO || d.atrasada) return "cara";
  if (d.planejada && taxaAnual(t) < selicAno) return "saudavel";
  return "atencao";
}

export const FRASE_DA_SAUDE: Record<Saude, { selo: string; frase: string }> = {
  saudavel: { selo: "Saudável", frase: "Essa é saudável: planejada e com juros abaixo da Selic. Segue pagando em dia." },
  atencao: { selo: "Atenção", frase: "Dá para ficar, mas vale renegociar ou antecipar." },
  cara: { selo: "Cara", frase: "Essa é a primeira a resolver." },
};

/** As que entram no herói e no plano: todas menos as saudáveis. */
export function paraResolver<T extends DividaDoSpi>(dividas: T[], selicAno: number): T[] {
  return dividas.filter((d) => saudeDe(d, selicAno) !== "saudavel");
}

export function saudaveis<T extends DividaDoSpi>(dividas: T[], selicAno: number): T[] {
  return dividas.filter((d) => saudeDe(d, selicAno) === "saudavel");
}

/** "Caixa · Apê"; sem um dos dois, o que houver. */
export function nomeDaDivida(credor: string, apelido: string): string {
  const c = credor.trim();
  const a = apelido.trim();
  return c && a ? `${c} · ${a}` : a || c;
}

/**
 * As parcelas sobre a renda, contando TODAS as dívidas (as saudáveis também). Acima de 30% é o
 * sinal de alerta do material 15. Sem renda, não há conta.
 */
export function parcelasSobreARenda(dividas: Divida[], renda: number): { proporcao: number; porMes: number; alerta: boolean } | null {
  if (!(renda > 0)) return null;
  const porMes = retratoDe(dividas).porMes;
  const proporcao = porMes / renda;
  return { proporcao, porMes, alerta: proporcao > LIMIAR_DE_SUPERENDIVIDAMENTO };
}

/** O nome que a lista de logos reconhece: "Caixa" sozinho é ambíguo no catálogo de marcas. */
export function descricaoDoCredor(credor: string): string {
  return credor.trim().toLowerCase() === "caixa" ? "Caixa Econômica" : credor;
}

export { perfilDoTipo };
