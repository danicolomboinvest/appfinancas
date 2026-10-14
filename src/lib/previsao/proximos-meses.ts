/**
 * Os próximos meses (14/10/2026): o que já está comprometido em cada mês que ainda não chegou,
 * contra a renda média. Voltou porque a versão nova de 11/10 tirou a tela do ano e travou o seletor
 * no mês de agora, e "ver os próximos meses, com previsibilidade dos gastos" virou motivo de
 * reembolso.
 *
 * Comprometido = parcelas (as lançadas e as projetadas pela compra) + contas da lista (pela regra de
 * repetição de cada uma) + assinaturas. Tudo previsto: o que ainda não aconteceu nunca vira gasto.
 * Puro, sem banco: o carregador (repositories/previsao.repo.ts) monta a entrada.
 */
import { lerData } from "@/lib/contas/contas";
import { ocorrencias, regraDaConta, type CamposDaRegra } from "@/lib/contas/frequencia";

export type Mes = { ano: number; mes: number };
export const indiceDoMes = (m: Mes) => m.ano * 12 + (m.mes - 1);
export const doIndiceDoMes = (i: number): Mes => ({ ano: Math.floor(i / 12), mes: (i % 12) + 1 });

export type ContaPrevista = CamposDaRegra & {
  nome: string;
  valor: number | null;
  /** O próximo vencimento ("AAAA-MM-DD"). */
  vencimento: string;
  assinatura: boolean;
};

export type ItemPrevisto = { nome: string; valor: number };

/** Quanto cada conta da lista cai no mês (a diarista a cada 2 semanas cai 2 ou 3 vezes). */
export function contasNoMes(contas: ContaPrevista[], m: Mes): { contas: ItemPrevisto[]; assinaturas: ItemPrevisto[] } {
  const de = new Date(Date.UTC(m.ano, m.mes - 1, 1));
  const ate = new Date(Date.UTC(m.ano, m.mes, 0));
  const contasDoMes: ItemPrevisto[] = [];
  const assinaturas: ItemPrevisto[] = [];
  for (const c of contas) {
    const v = c.valor ?? 0;
    const venc = lerData(c.vencimento);
    // Parcelada fica com as parcelas (parcelasDoMes já conta a conta parcelada).
    if (v <= 0 || !venc || (c.parcelas ?? 0) > 1) continue;
    const vezes = ocorrencias(venc, regraDaConta(c), de, ate).length;
    if (vezes === 0) continue;
    (c.assinatura ? assinaturas : contasDoMes).push({ nome: c.nome, valor: Math.round(v * vezes * 100) / 100 });
  }
  return { contas: contasDoMes, assinaturas };
}

export type MesPrevisto = Mes & {
  parcelas: ItemPrevisto[];
  contas: ItemPrevisto[];
  assinaturas: ItemPrevisto[];
  total: number;
  rendaMedia: number | null;
  /** O comprometido em % da renda média (null sem renda). */
  pct: number | null;
  /** As parcelas que acabaram no mês anterior: neste mês sobra o valor delas. */
  acabaram: ItemPrevisto[];
};

const soma = (xs: ItemPrevisto[]) => xs.reduce((s, x) => s + x.valor, 0);

export function montarMesPrevisto(
  m: Mes,
  e: { parcelas: ItemPrevisto[]; contas: ItemPrevisto[]; assinaturas: ItemPrevisto[]; acabaram: ItemPrevisto[]; rendaMedia: number | null },
): MesPrevisto {
  const total = Math.round((soma(e.parcelas) + soma(e.contas) + soma(e.assinaturas)) * 100) / 100;
  const renda = e.rendaMedia && e.rendaMedia > 0 ? e.rendaMedia : null;
  return { ...m, ...e, rendaMedia: renda, total, pct: renda ? Math.round((total / renda) * 100) : null };
}

/** A renda média dos meses fechados que tiveram entrada (até 3). Null: nenhuma entrada. */
export function rendaMedia(entradas: number[]): number | null {
  const com = entradas.filter((v) => v > 0).slice(-3);
  if (com.length === 0) return null;
  return Math.round(com.reduce((s, v) => s + v, 0) / com.length);
}

/** "Em dezembro acaba a parcela da Amazon: sobram R$ 89 a mais." Null se nada acabou. */
export function fraseDoQueAcaba(nomeDoMes: string, acabaram: ItemPrevisto[], money: (v: number) => string): string | null {
  if (acabaram.length === 0) return null;
  const valor = money(soma(acabaram));
  if (acabaram.length === 1) return `Em ${nomeDoMes} sai a parcela de ${acabaram[0].nome}: sobram ${valor} a mais.`;
  return `Em ${nomeDoMes} saem ${acabaram.length} parcelas: sobram ${valor} a mais.`;
}
