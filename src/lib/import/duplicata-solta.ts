import { normalizeMerchant, padraoAprendivel } from "@/lib/import/classify";

/**
 * Duplicata "solta": mesma data + mesmo valor + mesmo tipo de um lançamento que JÁ veio de outro
 * arquivo (ou do Open Finance), com a descrição escrita de outro jeito.
 *
 * Antes, bater só data + valor + tipo bastava pra pular a linha calada. A intenção era o mesmo
 * extrato subido de novo em outro formato (CSV numa semana, PDF no fim do mês), mas a chave não
 * olhava a descrição nem o banco: o "SAQUE 24H" de R$ 100 do Itaú era pulado porque o Nubank já
 * tinha um "PIX ENVIADO MARIA" de R$ 100 no mesmo dia, e o mês ficava com R$ 100 a menos.
 *
 * Decisão da Dani: descrição que bate (normalizada) continua pulando sozinha; descrição
 * diferente vira pergunta na revisão ("é o mesmo?"), como já era com o lançamento feito à mão.
 */

/** Sem acento, maiúscula, pontuação nem espaço repetido: "PIX ENVIADO - Maria" = "pix enviado maria". */
export function descricaoNormalizada(description: string | null): string {
  return (description ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * A mesma transação escrita por dois formatos do mesmo banco? Igual depois de normalizar, ou uma
 * é a outra cortada (o CSV corta a descrição que o PDF traz inteira: "PIX ENVIADO MARIA SIL").
 * O pedaço cortado precisa ter nome de verdade: "Pix enviado" sozinho é começo de todo Pix, e
 * pular por ele era voltar ao problema de antes.
 */
export function mesmaDescricao(a: string | null, b: string | null): boolean {
  const na = descricaoNormalizada(a);
  const nb = descricaoNormalizada(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [curta, longa] = na.length <= nb.length ? [na, nb] : [nb, na];
  return curta.length >= 10 && longa.startsWith(curta) && padraoAprendivel(normalizeMerchant(curta));
}

export type CasamentoSolto = { tipo: "mesmo" } | { tipo: "parecido"; descricao: string | null };

/** Lançamento já importado. `descricao` é o nome que o banco deu (o que se compara); `mostrar`,
 * o nome que ela vê hoje, quando renomeou ("Definir descrição"). */
export type ExistenteSolto = { descricao: string | null; mostrar?: string | null };

/**
 * Casa os itens do arquivo com os lançamentos já importados de mesma chave solta
 * (data|valor|tipo). Cada lançamento existente casa com UM item só.
 *
 * - `chaves[i]`: a chave solta do item i, ou null quando ele não entra nesta comparação.
 * - `existentes`: chave → os lançamentos já importados com ela.
 * - `jaCasados`: itens que outra regra já deu como existentes (a chave exata). Eles só gastam a
 *   vaga do lançamento deles aqui, senão sobrava vaga pra um item diferente ser pulado no lugar.
 * - `perguntar`: na leitura do arquivo, o que sobrar com a mesma chave e descrição diferente vira
 *   "parecido" (a tela pergunta). Na confirmação é false: a pergunta já foi feita.
 *
 * Três passadas, da mais certa pra menos: descrição igual, descrição cortada, qualquer uma. Na
 * ordem inversa, o "Uber R$ 15" novo podia gastar a vaga do "99 R$ 15" já importado.
 */
export function casarPorDataEValor(
  chaves: (string | null)[],
  descricoes: string[],
  existentes: Map<string, ExistenteSolto[]>,
  { perguntar, jaCasados = new Set<number>() }: { perguntar: boolean; jaCasados?: Set<number> },
): Map<number, CasamentoSolto> {
  const restantes = new Map([...existentes].map(([k, v]) => [k, [...v]]));
  const resultado = new Map<number, CasamentoSolto>();
  const tirar = (k: string, aceita: (d: string | null) => boolean): { achou: boolean; descricao: string | null } => {
    const lista = restantes.get(k) ?? [];
    const i = lista.findIndex((e) => aceita(e.descricao));
    if (i === -1) return { achou: false, descricao: null };
    const [e] = lista.splice(i, 1);
    return { achou: true, descricao: e.mostrar ?? e.descricao };
  };
  const iguais = (a: string) => (d: string | null) => descricaoNormalizada(d) === descricaoNormalizada(a);

  // O que já foi dado como existente só gasta a vaga do seu par.
  chaves.forEach((k, i) => {
    if (!k || !jaCasados.has(i)) return;
    // Sem par de descrição, o que ele achou foi um lançamento à mão: não gasta a vaga de um
    // importado diferente, que continua disponível pro item dele.
    if (!tirar(k, iguais(descricoes[i])).achou) tirar(k, (d) => mesmaDescricao(d, descricoes[i]));
  });
  const passada = (aceita: (i: number) => (d: string | null) => boolean, marca: (descricao: string | null) => CasamentoSolto) => {
    chaves.forEach((k, i) => {
      if (!k || jaCasados.has(i) || resultado.has(i)) return;
      const r = tirar(k, aceita(i));
      if (r.achou) resultado.set(i, marca(r.descricao));
    });
  };
  passada((i) => iguais(descricoes[i]), () => ({ tipo: "mesmo" }));
  passada((i) => (d) => mesmaDescricao(d, descricoes[i]), () => ({ tipo: "mesmo" }));
  if (perguntar) passada(() => () => true, (descricao) => ({ tipo: "parecido", descricao }));
  return resultado;
}
