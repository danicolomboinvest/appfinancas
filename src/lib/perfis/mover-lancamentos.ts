import type { ParentCategory, ProfileKind } from "@prisma/client";
import { parseInstallment, installmentCanonical, installmentDescription } from "@/lib/entries/recurrence";
import { chaveCobre, chaveDoComerciante, chaveUtil } from "@/lib/import/comerciante";
import { categorizarLinha } from "@/lib/import/motor";
import type { LearnedRule } from "@/lib/import/classify";

/**
 * Mover lançamentos JÁ importados de um perfil para outro (12/10/2026). Pedido da Dani: "tenho
 * despesas no meu cartão que são da empresa; na conta pessoal, quero selecionar o que enviar para
 * a outra conta". Antes isso só existia linha a linha na revisão da importação.
 *
 * Aqui mora só a conta, sem banco: qual categoria o lançamento leva no destino, o que dele não
 * faz sentido lá (meta, quem pagou no Casal, cliente da Empresa), quais parcelas são da mesma
 * compra e qual comerciante vira "sempre mandar para lá".
 */

export type LancamentoParaMover = {
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  parentCategory: ParentCategory | null;
  customCategoryId: string | null;
  subcategory: string | null;
  description: string | null;
  amount: number;
};

export type CategoriaNoDestino = {
  parentCategory: ParentCategory | null;
  customCategoryId: string | null;
  subcategory: string | null;
};

const ehEmpresa = (kind: ProfileKind | string | null | undefined) => kind === "EMPRESA";

/**
 * As categorias padrão têm a MESMA chave em todo perfil, mas na Empresa cada chave quer dizer
 * outra coisa (ALIMENTACAO é "Mercadorias e insumos", MORADIA é "Estrutura"). Entre dois perfis de
 * pessoa física (Pessoal, Casal) a chave vale como está; entrando ou saindo da Empresa, não.
 */
export function categoriasMudamDeSentido(origem: ProfileKind | string, destino: ProfileKind | string): boolean {
  return ehEmpresa(origem) !== ehEmpresa(destino);
}

/**
 * A categoria do lançamento no perfil de destino. Nunca aponta para categoria de outro perfil:
 *
 * 1. Renda e guardado não têm categoria (só a subcategoria, "Salário", que vale em qualquer perfil).
 * 2. A personalizada ("Pet") vale se o destino tem uma com o MESMO nome; senão o motor decide.
 * 3. A padrão fica como está quando o sentido não muda (Pessoal → Casal).
 * 4. Entrando ou saindo da Empresa, o motor de categorias do DESTINO (as regras que ela ensinou
 *    lá, a base comunitária e o dicionário daquele tipo de perfil) sugere.
 * 5. O motor não sabe: entra sem categoria, para ela revisar lá. Estorno sem categoria vai para
 *    Outros, como na importação (sem categoria ele contaria sozinho e a compra não seria abatida).
 */
export function categoriaNoDestino(entrada: {
  lancamento: LancamentoParaMover;
  origemKind: ProfileKind | string;
  destinoKind: ProfileKind | string;
  /** O nome da personalizada no perfil de origem (quando o lançamento tem uma). */
  nomeDaPersonalizada?: string | null;
  /** As personalizadas do destino. */
  personalizadasDoDestino: { id: string; name: string }[];
  /** As regras que ela ensinou no destino. */
  regrasDoDestino: LearnedRule[];
}): CategoriaNoDestino {
  const { lancamento: l } = entrada;
  if (l.category !== "EXPENSE") return { parentCategory: null, customCategoryId: null, subcategory: l.subcategory };

  if (l.customCategoryId) {
    const nome = normalizar(entrada.nomeDaPersonalizada);
    const igual = nome ? entrada.personalizadasDoDestino.find((c) => normalizar(c.name) === nome) : undefined;
    if (igual) return { parentCategory: null, customCategoryId: igual.id, subcategory: null };
  } else if (l.parentCategory && !categoriasMudamDeSentido(entrada.origemKind, entrada.destinoKind)) {
    return { parentCategory: l.parentCategory, customCategoryId: null, subcategory: l.subcategory };
  }

  const estorno = l.amount < 0;
  const achada = l.description
    ? categorizarLinha({
        descricao: l.description,
        regras: entrada.regrasDoDestino,
        profileKind: entrada.destinoKind,
        gasto: !estorno,
        personalizadas: new Set(entrada.personalizadasDoDestino.map((c) => c.id)),
      })
    : null;
  if (achada) {
    const c = achada.classificacao;
    if (c.customCategoryId) return { parentCategory: null, customCategoryId: c.customCategoryId, subcategory: null };
    return { parentCategory: c.parentCategory, customCategoryId: null, subcategory: c.subcategory ?? null };
  }
  return { parentCategory: estorno ? "OUTROS" : null, customCategoryId: null, subcategory: null };
}

function normalizar(texto: string | null | undefined): string {
  return (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/**
 * O que é de um tipo de perfil só e não pode ir junto: quem pagou e o "só meu" (Casal), cliente,
 * forma e dia de receber (Empresa). A meta é sempre do perfil de origem e sai.
 */
export function camposQueSaem(destinoKind: ProfileKind | string): {
  goalId: null;
  pessoa?: null;
  doCasal?: null;
  soMeu?: false;
  cliente?: null;
  formaDeRecebimento?: null;
  recebeEm?: null;
  recebidoEm?: null;
} {
  return {
    goalId: null,
    // Entrando no Casal também zera: o "A" de um perfil não diz nada no outro.
    pessoa: null,
    doCasal: null,
    soMeu: false,
    ...(ehEmpresa(destinoKind) ? {} : { cliente: null, formaDeRecebimento: null, recebeEm: null, recebidoEm: null }),
  };
}

/**
 * A chave da compra parcelada: a descrição com o "N/T" zerado ("LOJA PARC 03/06" e "LOJA PARC
 * 04/06" dão a mesma). Só parcela com certeza (ver parseInstallment): "POSTO 03/09" é data.
 */
export function chaveDaCompraParcelada(descricao: string | null): { chave: string; total: number } | null {
  const p = parseInstallment(descricao);
  if (!p?.confident || !descricao) return null;
  return { chave: installmentCanonical(installmentDescription(descricao, 1, p.total)).trim().toLowerCase(), total: p.total };
}

/** A 1ª parcela absorve o arredondamento (R$ 100 em 3x = 33,34 + 33,33 + 33,33). */
function mesmoValorDeParcela(a: number, b: number, total: number): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) <= (total - 1) * 0.01 + 0.005;
}

/**
 * As OUTRAS parcelas da mesma compra entre `candidatos` (os lançamentos do perfil de origem): mesma
 * descrição sem o "N/T", mesmo total de parcelas e o mesmo valor (com a folga dos centavos).
 * Devolve os ids que ainda não estão em `escolhidos`.
 */
export function parcelasDaMesmaCompra(
  escolhidos: { id: string; description: string | null; amount: number }[],
  candidatos: { id: string; description: string | null; amount: number }[],
): string[] {
  const ja = new Set(escolhidos.map((e) => e.id));
  const compras = escolhidos.flatMap((e) => {
    const c = chaveDaCompraParcelada(e.description);
    return c ? [{ ...c, amount: e.amount }] : [];
  });
  if (compras.length === 0) return [];
  const achados = new Set<string>();
  for (const c of candidatos) {
    if (ja.has(c.id)) continue;
    const k = chaveDaCompraParcelada(c.description);
    if (!k) continue;
    if (compras.some((x) => x.chave === k.chave && x.total === k.total && mesmoValorDeParcela(x.amount, c.amount, k.total))) achados.add(c.id);
  }
  return [...achados];
}

/**
 * Os comerciantes que dá para lembrar ("sempre mandar para a Empresa"): a chave do comerciante de
 * cada lançamento, sem repetir, só as que identificam um lugar de verdade (chaveUtil).
 */
export function comerciantesParaLembrar(descricoes: (string | null)[]): string[] {
  return [...new Set(descricoes.map((d) => chaveDoComerciante(d)).filter((k) => chaveUtil(k)))];
}

/**
 * A regra "sempre mandar" que vale para a linha (a mais específica, como nas regras de categoria).
 * `null` = fica no perfil da importação.
 */
export function destinoPelaRegra(descricao: string, regras: { pattern: string; destinoProfileId: string }[]): string | null {
  const chave = chaveDoComerciante(descricao);
  if (!chave) return null;
  let melhor: { pattern: string; destinoProfileId: string } | null = null;
  for (const r of regras) {
    if (!chaveCobre(r.pattern, chave)) continue;
    if (!melhor || r.pattern.length > melhor.pattern.length) melhor = r;
  }
  return melhor?.destinoProfileId ?? null;
}
