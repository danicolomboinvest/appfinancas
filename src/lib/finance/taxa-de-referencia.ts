/**
 * Qual taxa de referência usar quando o app procura "o CDI" entre as taxas visíveis (as da
 * pessoa + as globais do sistema).
 *
 * A que ELA cadastrou em Configurações › Taxas ganha sempre da global; entre as do mesmo dono,
 * a de vigência mais recente. Antes a global ganhava: a busca pegava a primeira por nome e data
 * (e o banco, ordenando por dono, põe as globais — dono nulo — na frente), então a taxa que
 * ela digitou não tinha efeito nenhum.
 */
export function escolherTaxaDeReferencia<T extends { name: string; userId: string | null; effectiveDate: Date }>(
  taxas: T[],
  userId: string,
  nome: RegExp,
): T | undefined {
  return taxas
    .filter((t) => nome.test(t.name))
    .sort((a, b) => {
      const donoA = a.userId === userId ? 0 : 1;
      const donoB = b.userId === userId ? 0 : 1;
      if (donoA !== donoB) return donoA - donoB;
      return b.effectiveDate.getTime() - a.effectiveDate.getTime();
    })[0];
}
