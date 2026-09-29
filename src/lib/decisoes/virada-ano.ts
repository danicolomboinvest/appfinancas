/**
 * A virada do ano: fecha o ano que passou e sugere como começar o próximo.
 *
 * Sem isso, em 1º de janeiro todo mundo começava zerado: o orçamento, o plano do mês e as contas
 * fixas eram gravados por ano e não passavam pro ano novo. A Dani pediu o contrário de zerar
 * calado: mostrar o ano, sugerir o próximo com base no que a pessoa viveu, e perguntar se ela
 * quer começar assim ou do zero.
 *
 * A sugestão segue a aula: o plano de cada categoria vem do que ela planejou, a não ser que o
 * gasto de verdade tenha ficado bem acima (aí o plano estava baixo e ia estourar de novo); guardar
 * é no mínimo 10% da renda (a fatia de liberdade financeira); e os gastos cabem em 90% da renda.
 *
 * Puro, sem banco.
 */

export type ViradaCategoria = {
  key: string;
  label: string;
  /** O que estava planejado no último mês do ano. */
  planejado: number;
  /** Média do que foi gasto de fato nos últimos meses do ano. */
  realMedio: number;
  /** Categoria-mãe (true) ou personalizada. */
  mae: boolean;
};

export type ViradaEntrada = {
  ano: number;
  renda: { planejada: number | null; mediana: number | null };
  guardarPlanejado: number | null;
  categorias: ViradaCategoria[];
};

export type ViradaSugestao = {
  renda: number;
  guardar: number;
  categorias: (ViradaCategoria & { sugerido: number; motivo: "plano" | "real" | "novo" })[];
  totalGastos: number;
  /** Renda − guardar − gastos: o que fica sem destino. Negativo = a sugestão não fecha. */
  semDestino: number;
  avisos: string[];
};

const PISO_GUARDAR = 0.1;
const LIMITE_GASTO = 0.9;
/** Gasto real 10% acima do plano: o plano estava baixo. Abaixo disso é variação normal. */
const FOLGA_PLANO = 1.1;

const arredonda10 = (v: number) => Math.ceil(v / 10) * 10;

export function sugerirAno(e: ViradaEntrada, money: (v: number) => string): ViradaSugestao {
  const renda = e.renda.planejada && e.renda.planejada > 0 ? e.renda.planejada : (e.renda.mediana ?? 0);
  const minimoGuardar = arredonda10(renda * PISO_GUARDAR);
  const guardar = Math.max(e.guardarPlanejado ?? 0, minimoGuardar);

  const categorias = e.categorias
    .filter((c) => c.planejado > 0 || c.realMedio >= 1)
    .map((c) => {
      if (c.planejado <= 0) return { ...c, sugerido: arredonda10(c.realMedio), motivo: "novo" as const };
      if (c.realMedio > c.planejado * FOLGA_PLANO) return { ...c, sugerido: arredonda10(c.realMedio), motivo: "real" as const };
      return { ...c, sugerido: c.planejado, motivo: "plano" as const };
    });
  const totalGastos = categorias.reduce((s, c) => s + c.sugerido, 0);
  const semDestino = renda - guardar - totalGastos;

  const avisos: string[] = [];
  if (!(renda > 0)) avisos.push("Não achei sua renda do ano passado. Preencha a renda do mês pra sugestão ficar completa.");
  if ((e.guardarPlanejado ?? 0) < minimoGuardar && renda > 0) {
    avisos.push(`Pra guardar pelo menos 10% da renda, a sugestão é ${money(guardar)} por mês.`);
  }
  if (renda > 0 && totalGastos > renda * LIMITE_GASTO) {
    avisos.push(`Os gastos sugeridos (${money(totalGastos)}) passam de 90% da renda (${money(renda * LIMITE_GASTO)}). Vale escolher onde cortar antes de começar.`);
  } else if (renda > 0 && semDestino < 0) {
    avisos.push(`Com ${money(guardar)} guardados por mês, a conta não fecha: faltam ${money(-semDestino)}. Vale ajustar alguma categoria.`);
  }
  return { renda, guardar, categorias, totalGastos, semDestino, avisos };
}

/** O que identifica uma conta fixa: a descrição e a categoria. */
export type ContaFixaChave = { descricao: string | null; valor: number; parentCategory: string | null; customCategoryId: string | null };

const normalizar = (s: string | null) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Mesma conta, qualquer valor: o aluguel de R$ 2.000 e o de R$ 2.100 (reajuste de janeiro) são uma conta só. */
const chaveSemValor = (f: Omit<ContaFixaChave, "valor">) => `${normalizar(f.descricao)}|${f.customCategoryId ?? f.parentCategory ?? ""}`;

/** A chave que a tela usa pra ela marcar ou desmarcar cada conta fixa (aqui o valor entra: são linhas diferentes). */
export function chaveDaContaFixa(f: ContaFixaChave): string {
  return `${chaveSemValor(f)}|${f.valor.toFixed(2)}`;
}

/**
 * As contas fixas do ano passado que ainda NÃO estão no ano novo. Compara pela descrição e pela
 * categoria, sem o valor: com o valor, o aluguel reajustado que ela já lançou em janeiro
 * (R$ 2.100, repetindo até dezembro) não batia com o de dezembro (R$ 2.000), e o ano inteiro
 * ficava com aluguel em dobro. Olha todos os meses que a série vai ocupar (`jaNoAnoNovo` vem do
 * mês de início em diante), não só o primeiro. Duas contas com o mesmo nome no mesmo mês (a
 * escola de cada filho) contam duas vezes.
 */
export function contasFixasQueFaltam<T extends ContaFixaChave>(
  fixas: T[],
  jaNoAnoNovo: (Omit<ContaFixaChave, "valor"> & { month: number })[],
): T[] {
  const porMes = new Map<string, Map<number, number>>();
  for (const e of jaNoAnoNovo) {
    const k = chaveSemValor(e);
    const meses = porMes.get(k) ?? new Map<number, number>();
    meses.set(e.month, (meses.get(e.month) ?? 0) + 1);
    porMes.set(k, meses);
  }
  const usadas = new Map<string, number>();
  return fixas.filter((f) => {
    const k = chaveSemValor(f);
    const existentes = Math.max(0, ...(porMes.get(k)?.values() ?? []));
    const jaUsadas = usadas.get(k) ?? 0;
    if (jaUsadas < existentes) {
      usadas.set(k, jaUsadas + 1);
      return false;
    }
    return true;
  });
}
