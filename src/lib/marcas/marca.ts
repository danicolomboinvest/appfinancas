import { MARCAS, type MarcaDoCatalogo } from "./catalogo";

/**
 * Qual marca é este lançamento, pela descrição que veio do extrato ("IFOOD *RESTAURANTE",
 * "NETFLIX.COM", "Pix enviado Mercado Livre"). Sem acento, sem maiúscula e por palavra inteira:
 * "internet" não vira o banco Inter, "Oi" sozinho não casa com qualquer "oi".
 *
 * Regra de desempate: o apelido mais comprido ganha ("amazon prime" ganha de "amazon"), e as
 * marcas genéricas (Pix, bandeira do cartão, Google, Apple) só valem quando nenhuma outra casa.
 * Sem marca conhecida, devolve null, e a tela mostra o quadrado cinza com o ícone da categoria.
 */
export type Marca = MarcaDoCatalogo & { src: string };

export function normalizarDescricao(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const INDICE = MARCAS.flatMap((m) => m.apelidos.map((apelido) => ({ apelido, marca: m })))
  // Mais comprido primeiro; entre iguais, a marca específica antes da genérica.
  .sort((a, b) => Number(a.marca.baixa ?? false) - Number(b.marca.baixa ?? false) || b.apelido.length - a.apelido.length);

export function marcaDaDescricao(descricao: string | null | undefined): Marca | null {
  if (!descricao) return null;
  const texto = ` ${normalizarDescricao(descricao)} `;
  if (texto.trim() === "") return null;
  for (const { apelido, marca } of INDICE) {
    if (texto.includes(` ${apelido} `)) return { ...marca, src: `/brand/marcas/${marca.arquivo}` };
  }
  return null;
}

/**
 * Marcas conhecidas que NÃO têm logo limpo disponível (levantamento de 10/10/2026, cores.json
 * `_faltaram`). Lançamento delas ganha o quadrado cinza com o ícone da categoria; lançamento que
 * não é de marca (Aluguel, Salário) ganha o círculo no tom da categoria.
 */
const MARCAS_SEM_LOGO = ["pao de acucar", "rico", "tesouro direto", "droga raia", "clear", "avenue", "nomad", "neon", "toro", "outback", "coco bambu", "veloe", "decolar", "totalpass", "alura"];

export function ehMarcaSemLogo(descricao: string | null | undefined): boolean {
  if (!descricao) return false;
  const texto = ` ${normalizarDescricao(descricao)} `;
  return MARCAS_SEM_LOGO.some((m) => texto.includes(` ${m} `));
}
