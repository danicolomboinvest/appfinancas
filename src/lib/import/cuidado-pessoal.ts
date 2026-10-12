/**
 * A categoria "Cuidado pessoal" da importação (12/10/2026, pedido da Dani).
 *
 * O dicionário reconhece roupa, calçado e beleza (Zara, Levi's, Renner, O Boticário, salão,
 * manicure; ver KW_CUIDADO_PESSOAL em dicionario.ts) e marca a linha com `cuidadoPessoal`. Na
 * importação, a linha vai para a categoria dela desse assunto: a que ela já criou com nome
 * parecido ("Beleza", "Roupas", "Cuidados pessoais") ou, se não tem nenhuma, uma "Cuidado
 * pessoal" criada na hora, uma vez só por perfil. Perfil Empresa nunca ganha categoria pessoal.
 *
 * Puro: quem fala com o banco é garantirCuidadoPessoal (custom-category.repo.ts).
 */

export const NOME_CUIDADO_PESSOAL = "Cuidado pessoal";
/** Sacola (a chave "shopping-bag" de CUSTOM_CATEGORY_ICON_OPTIONS). */
export const ICONE_CUIDADO_PESSOAL = "shopping-bag";

function palavras(nome: string): string {
  return ` ${nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** Do nome mais exato ao mais largo: "Cuidado pessoal" ganha de "Beleza", que ganha de "Roupas". */
const PARECIDOS: RegExp[] = [
  / (cuidados? pessoa(l|is)|autocuidado|auto cuidado) /,
  / (beleza|estetica|skincare|skin care) /,
  / (roupas?|vestuario|moda|vestimentas?) /,
];

/** A categoria dela que serve para roupa/beleza, ou null. Na dúvida entre duas, a mais antiga. */
export function categoriaParecida<T extends { name: string }>(categorias: T[]): T | null {
  for (const re of PARECIDOS) {
    const achada = categorias.find((c) => re.test(palavras(c.name)));
    if (achada) return achada;
  }
  return null;
}
