import { mesmaDescricao } from "./duplicata-solta";
import { nomeParecido } from "./parecido-manual";
import { chaveDoComerciante } from "./comerciante";

/**
 * "Essa movimentação parece já estar no app. Importar mesmo assim?" (feedback de uma cliente,
 * aprovado pela Dani em 15/10/2026).
 *
 * As regras de antes (parecido-manual e duplicata-solta) só resolvem o quase certo: valor até 1% e
 * até 3 dias com o lançamento à mão, e o mesmo dia com o que veio de outro arquivo. Fora disso a
 * linha entrava calada e o gasto ficava em dobro em três casos:
 * a) o lançamento à mão com a gorjeta ou os centavos de diferença, ou com 4 ou 5 dias de distância;
 * b) a mesma compra vinda de outro banco ou arquivo com outro dia (data da compra × data do débito);
 * c) no casal, os dois subindo o mesmo cartão (a busca só olhava quem importa).
 *
 * Aqui nada é apagado nem pulado sozinho: o par vira PERGUNTA na fila. O critério olha data, valor,
 * descrição normalizada, conta/cartão e tipo:
 * - o mesmo tipo (gasto com gasto, entrada com entrada) e o mesmo sinal;
 * - até 5 dias de distância (o lançamento sem dia fica com a regra de antes);
 * - nome que bate: até 5% de diferença no valor, ou até 12% quando o arquivo é MAIOR que o
 *   lançado à mão (a gorjeta de 10%);
 * - nome diferente: o valor tem de ser igual (até R$ 0,01) e a distância até 3 dias (a mesma da
 *   dúvida de antes com o lançamento à mão);
 * - conta/cartão: o que já veio da MESMA conta de quem importa só vale no mesmo dia (o banco
 *   escreve sempre a mesma data, e o mesmo dia já é coberto pela chave solta). Dia diferente na
 *   mesma conta é outra compra.
 *
 * Os falsos positivos que a auditoria achou (cerca de 1.100 compras repetidas de verdade dentro do
 * mesmo arquivo: ônibus, metrô, café) ficam de fora de dois jeitos: o arquivo nunca é comparado com
 * ele mesmo, e a compra que se repete (no arquivo ou no app, mesmo nome e valor) só casa no mesmo
 * dia. Cada lançamento do app casa com UMA linha, e as linhas que outra regra já resolveu gastam a
 * vaga do par delas antes.
 *
 * Puro, sem banco: import-actions busca os lançamentos (os dela e, no casal, só os que o par deixou
 * visíveis) e aplica o resultado.
 */

export const TOLERANCIA_JA_NO_APP = {
  /** Distância máxima entre as datas. */
  dias: 5,
  /** Diferença máxima no valor quando o nome bate. */
  valorComNome: 0.05,
  /** Gorjeta: o arquivo maior que o lançado à mão, nome que bate. */
  gorjeta: 0.12,
  /** "Valor igual" quando o nome não bate. */
  centavo: 0.01,
  /** Distância máxima quando o nome não bate. */
  diasSemNome: 3,
} as const;

export { TEXTO_JA_NO_APP, tituloDoGrupo } from "./ja-no-app-texto";

const DIA_MS = 86_400_000;

export type LinhaNova = {
  key: number;
  /** "AAAA-MM-DD". */
  date: string;
  description: string;
  /** Com sinal, como seria gravado (estorno negativo). */
  valor: number;
  category: string;
  /** Outra regra já resolveu a linha (já no app, pergunta de antes): só gasta a vaga do par dela. */
  resolvida?: boolean;
  /** Fatura: o mês em que ela conta ("AAAA-MM", o do vencimento). Casa com a compra sem dia. */
  mesDaFatura?: string | null;
};

export type JaNoApp = {
  id: string;
  category: string;
  /** Com sinal, como está no banco. */
  amount: number;
  /** "AAAA-MM-DD", ou null na compra de fatura gravada sem dia (o mês da fatura). */
  date: string | null;
  /** "AAAA-MM": o mês do lançamento (o que vale quando não tem dia). */
  mes?: string;
  description: string | null;
  /** O nome que o banco deu, quando ela renomeou. É o que se compara. */
  descricaoOriginal?: string | null;
  /** null = lançado à mão; senão a conta (ver chaveDaConta em lib/casa/regras). */
  conta: string | null;
  /** Do par, na casa (só o que ele deixou visível chega aqui). */
  doPar?: boolean;
};

function diasEntre(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DIA_MS);
}

/** Nome e valor: o que faz "a mesma compra de sempre" (ônibus de R$ 4,40). */
function marcaDaCompra(descricao: string | null | undefined, valor: number): string {
  return `${chaveDoComerciante(descricao) || (descricao ?? "").toLowerCase().trim()}|${valor.toFixed(2)}`;
}

function contar(chaves: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of chaves) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

export type ParDoJaNoApp = { linha: LinhaNova; existente: JaNoApp; dias: number; dif: number; nomeBate: boolean };

/**
 * O par serve? Devolve a "força" dele para ordenar, ou null. `repete` diz que a compra se repete
 * (no arquivo ou no app) e então só vale no mesmo dia.
 */
export function avaliarPar(
  linha: LinhaNova,
  e: JaNoApp,
  { contaDoArquivo, repete }: { contaDoArquivo: string | null; repete: boolean },
): ParDoJaNoApp | null {
  if (e.category !== linha.category) return null;
  if (Math.sign(e.amount) !== Math.sign(linha.valor) || linha.valor === 0) return null;
  if (!Number.isFinite(Date.parse(`${linha.date}T12:00:00Z`))) return null;
  if (e.date === null) return avaliarSemDia(linha, e);
  if (!Number.isFinite(Date.parse(`${e.date}T12:00:00Z`))) return null;
  const dias = diasEntre(linha.date, e.date);
  if (dias > TOLERANCIA_JA_NO_APP.dias) return null;
  if (repete && dias > 0) return null;
  // A mesma conta de quem importa: o banco escreve sempre a mesma data.
  if (!e.doPar && e.conta !== null && contaDoArquivo !== null && e.conta === contaDoArquivo && dias > 0) return null;
  const nomeDoApp = e.descricaoOriginal ?? e.description;
  const nomeBate = nomeParecido(linha.description, nomeDoApp) || mesmaDescricao(linha.description, nomeDoApp) || (e.description !== nomeDoApp && nomeParecido(linha.description, e.description));
  const dif = Math.abs(Math.abs(linha.valor) - Math.abs(e.amount));
  const base = Math.abs(linha.valor);
  const valorIgual = dif <= TOLERANCIA_JA_NO_APP.centavo + 1e-9;
  if (!valorIgual) {
    if (!nomeBate) return null;
    const gorjeta = e.conta === null && !e.doPar && linha.category === "EXPENSE" && Math.abs(linha.valor) > Math.abs(e.amount);
    const limite = (gorjeta ? TOLERANCIA_JA_NO_APP.gorjeta : TOLERANCIA_JA_NO_APP.valorComNome) * base;
    if (dif > limite + 1e-9) return null;
  } else if (!nomeBate && dias > TOLERANCIA_JA_NO_APP.diasSemNome) {
    return null;
  }
  return { linha, existente: e, dias, dif, nomeBate };
}

/**
 * A compra de fatura gravada sem dia (a fatura conta inteira no mês do vencimento): sem a data, só
 * o mais certo. O mesmo mês da fatura (ou o da compra), o nome que bate e o valor igual. É o caso
 * do casal subindo a mesma fatura.
 */
function avaliarSemDia(linha: LinhaNova, e: JaNoApp): ParDoJaNoApp | null {
  if (!e.mes) return null;
  if (e.mes !== linha.mesDaFatura && e.mes !== linha.date.slice(0, 7)) return null;
  const nomeDoApp = e.descricaoOriginal ?? e.description;
  if (!(nomeParecido(linha.description, nomeDoApp) || mesmaDescricao(linha.description, nomeDoApp))) return null;
  const dif = Math.abs(Math.abs(linha.valor) - Math.abs(e.amount));
  if (dif > TOLERANCIA_JA_NO_APP.centavo + 1e-9) return null;
  // Depois dos pares com dia: sem a data, é o menos certo.
  return { linha, existente: e, dias: TOLERANCIA_JA_NO_APP.dias, dif, nomeBate: true };
}

/**
 * Casa as linhas do arquivo com o que já está no app. Devolve, por linha NÃO resolvida, o
 * lançamento que parece ser ela. Cada lançamento casa com uma linha só; as resolvidas casam
 * primeiro (gastam a vaga do par delas) e não aparecem no resultado.
 */
export function casarJaNoApp(linhas: LinhaNova[], existentes: JaNoApp[], { contaDoArquivo }: { contaDoArquivo: string | null }): Map<number, JaNoApp> {
  const noArquivo = contar(linhas.map((l) => marcaDaCompra(l.description, l.valor)));
  // No app: a compra que se repete na mesma conta (ou toda à mão, ou toda do par).
  const contaDe = (e: JaNoApp) => `${e.doPar ? "par" : "eu"}|${e.conta ?? "mao"}`;
  const noApp = contar(existentes.map((e) => `${contaDe(e)}|${marcaDaCompra(e.descricaoOriginal ?? e.description, e.amount)}`));
  const repete = (l: LinhaNova, e: JaNoApp) =>
    (noArquivo.get(marcaDaCompra(l.description, l.valor)) ?? 0) > 1 || (noApp.get(`${contaDe(e)}|${marcaDaCompra(e.descricaoOriginal ?? e.description, e.amount)}`) ?? 0) > 1;

  const usados = new Set<string>();
  const resultado = new Map<number, JaNoApp>();
  const casadas = new Set<number>();
  for (const resolvidas of [true, false]) {
    const pares: ParDoJaNoApp[] = [];
    for (const linha of linhas) {
      if (!!linha.resolvida !== resolvidas) continue;
      for (const e of existentes) {
        if (usados.has(e.id)) continue;
        const p = avaliarPar(linha, e, { contaDoArquivo, repete: repete(linha, e) });
        if (p) pares.push(p);
      }
    }
    // O mais certo primeiro: mesmo dia, nome que bate, menor diferença.
    pares.sort((a, b) => a.dias - b.dias || Number(b.nomeBate) - Number(a.nomeBate) || a.dif - b.dif);
    for (const p of pares) {
      if (casadas.has(p.linha.key) || usados.has(p.existente.id)) continue;
      casadas.add(p.linha.key);
      usados.add(p.existente.id);
      if (!resolvidas) resultado.set(p.linha.key, p.existente);
    }
  }
  return resultado;
}
