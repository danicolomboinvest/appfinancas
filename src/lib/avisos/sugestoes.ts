import { avisoResolvido, respostaDaDecisao, TIPOS_DE_SUGESTAO, type ComoResolveu, type Resposta, type TipoDeSugestao } from "./regra";

/**
 * A fila de sugestões do Resumo novo: uma por vez, na ordem de prioridade. O "já respondido" de
 * cada sugestão é a regra única (regra.ts); aqui fica só o que é do cartão em si: a pausa do tipo
 * (duas dispensas do mesmo tipo pausam 30 dias) e o "Boa" do indo bem (uma vez por semana).
 */

export { TIPOS_DE_SUGESTAO, type TipoDeSugestao };

export type Sugestao = {
  tipo: TipoDeSugestao;
  /** Identifica a sugestão dentro do tipo ("cartao", "LAZER", "fechar-2026-09"). */
  id: string;
  /** Uma frase com um número dela. */
  texto: string;
  /** O botão que faz a coisa. "Algo indo bem" não tem: só "Boa". */
  botao: { rotulo: string; href: string } | null;
  /** Fura a ordem dos tipos: "Fechar setembro" nos dias 1 a 7 vem logo depois do dado que falta. */
  prioridade?: number;
  /** O tamanho do aviso (quanto a categoria subiu): guardado na resposta, decide quando ele volta. */
  excesso?: number;
};

/** Um "Agora não" (ou o "Boa" do indo bem, ou o toque no botão) guardado. */
export type Dispensa = {
  tipo: TipoDeSugestao;
  id: string;
  /** A marca do extrato quando ela dispensou: a sugestão volta quando chega um extrato novo. */
  marca: string;
  em: Date;
  /** "Boa" no indo bem: não conta para pausar o tipo. */
  boa?: boolean;
  /** A semana do "Boa" ("2026-W42"): o indo bem aparece no máximo uma vez por semana. */
  semana?: string;
  /** Como ela respondeu ("agora-nao", "botao"); dispensas antigas não têm. */
  como?: ComoResolveu;
  /** O gasto da categoria e quanto tinha subido, na hora (só na sugestão de categoria). */
  gasto?: number;
  excesso?: number;
};

export const PAUSA_DO_TIPO_DIAS = 30;
const DIA_MS = 86_400_000;

/**
 * Até quando o tipo está pausado. Cada duas dispensas do mesmo tipo pausam 30 dias, contadas da
 * segunda; o que ela dispensou durante a pausa não conta para a próxima. Tocar no botão é fazer a
 * coisa, não dispensar: não conta.
 */
export function tipoPausadoAte(dispensas: Dispensa[], tipo: TipoDeSugestao): Date | null {
  const doTipo = dispensas.filter((d) => d.tipo === tipo && !d.boa && d.como !== "botao").sort((a, b) => a.em.getTime() - b.em.getTime());
  let pausa: Date | null = null;
  let seguidas = 0;
  for (const d of doTipo) {
    if (pausa && d.em < pausa) continue;
    seguidas += 1;
    if (seguidas === 2) {
      pausa = new Date(d.em.getTime() + PAUSA_DO_TIPO_DIAS * DIA_MS);
      seguidas = 0;
    }
  }
  return pausa;
}

/** A dispensa do Resumo como resposta da regra única. */
export function respostaDaDispensa(d: Dispensa): Resposta | null {
  return respostaDaDecisao({
    tipo: "sugestao_dispensada",
    chave: `${d.tipo}|${d.id}`,
    valor: null,
    descricao: d.marca,
    dados: { boa: d.boa === true, como: d.como, gasto: d.gasto, excesso: d.excesso },
  });
}

export type ContextoDaFila = { marca: string; agora: Date; semana: string };

/**
 * A sugestão já foi respondida? Sem `resolvida`, vale só o que o próprio Resumo guardou (o "Agora
 * não" até o próximo extrato). Quem carrega do banco passa a regra inteira (respostas.ts), com as
 * respostas de todas as telas.
 */
function respondida(s: Sugestao, dispensas: Dispensa[], ctx: ContextoDaFila): boolean {
  const respostas = dispensas.map(respostaDaDispensa).filter((r): r is Resposta => r !== null);
  return avisoResolvido({ tipo: "sugestao", sugestao: s.tipo, id: s.id, marca: ctx.marca }, respostas);
}

/** A sugestão está escondida? (respondida, tipo pausado, ou "Boa" nesta semana) */
export function escondida(s: Sugestao, dispensas: Dispensa[], ctx: ContextoDaFila, resolvida?: (s: Sugestao) => boolean): boolean {
  const pausa = tipoPausadoAte(dispensas, s.tipo);
  if (pausa && ctx.agora < pausa) return true;
  if (s.tipo === "indo-bem" && dispensas.some((d) => d.tipo === "indo-bem" && d.semana === ctx.semana)) return true;
  return resolvida ? resolvida(s) : respondida(s, dispensas, ctx);
}

/**
 * Uma por vez: a primeira da fila (já na ordem de prioridade) que não está escondida. Sem nada,
 * o cartão não aparece: nunca uma frase genérica para encher espaço.
 */
export function escolherSugestao(fila: Sugestao[], dispensas: Dispensa[], ctx: ContextoDaFila, resolvida?: (s: Sugestao) => boolean): Sugestao | null {
  const ordem = (s: Sugestao) => s.prioridade ?? TIPOS_DE_SUGESTAO.indexOf(s.tipo);
  return [...fila].sort((a, b) => ordem(a) - ordem(b)).find((s) => !escondida(s, dispensas, ctx, resolvida)) ?? null;
}
