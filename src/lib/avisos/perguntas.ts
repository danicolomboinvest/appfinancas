import { avisoResolvido, type AvisoAtual, type Resposta, type TipoDaCategoria } from "./regra";
import { escolherSugestao, type ContextoDaFila, type Dispensa, type Sugestao } from "./sugestoes";

/**
 * As perguntas que as telas fazem à regra única ("mostro este aviso?"), sobre as respostas do mês
 * já carregadas (respostas.ts). Puro: o teste "resolve numa tela, some em todas" usa exatamente
 * estas funções, as mesmas das telas.
 */

export type MesDoAviso = { ano: number; mes: number };

export type RespostasDoMes = {
  mes: MesDoAviso;
  respostas: Resposta[];
  /** As dispensas do Resumo novo (90 dias), para a pausa do tipo e a semana do "Boa". */
  dispensas: Dispensa[];
  /** A marca do extrato mais recente ("sem-extrato" sem nenhum). */
  marca: string;
  /** Gasto e plano de cada categoria no mês, agora (chave: categoria-mãe ou id da personalizada). */
  gasto: Record<string, number>;
  plano: Record<string, number>;
};

/** O aviso de categoria com o gasto e o plano da régua do módulo. */
export function avisoDaCategoria(r: RespostasDoMes, tipo: TipoDaCategoria, categoria: string): AvisoAtual {
  const gasto = r.gasto[categoria] ?? 0;
  return { tipo, categoria, gasto, passou: gasto - (r.plano[categoria] ?? 0), marca: r.marca };
}

/** A tela pergunta: este aviso de categoria já foi respondido (em qualquer tela)? */
export function categoriaResolvida(r: RespostasDoMes, tipo: TipoDaCategoria, categoria: string): boolean {
  return avisoResolvido(avisoDaCategoria(r, tipo, categoria), r.respostas);
}

/** A tela pergunta: este aviso (meta, reserva, fora, guardar, Raio-X, sugestão) já foi respondido? */
export function resolvido(r: RespostasDoMes, aviso: AvisoAtual): boolean {
  if (aviso.tipo === "estouro" || aviso.tipo === "ritmo" || aviso.tipo === "categoria-subiu") return categoriaResolvida(r, aviso.tipo, aviso.categoria);
  return avisoResolvido(aviso, r.respostas);
}

/** A sugestão do Resumo novo já foi respondida? A de categoria segue a regra da categoria. */
export function sugestaoResolvida(r: RespostasDoMes, s: Pick<Sugestao, "tipo" | "id">): boolean {
  if (s.tipo === "categoria") return categoriaResolvida(r, "categoria-subiu", s.id);
  return avisoResolvido({ tipo: "sugestao", sugestao: s.tipo, id: s.id, marca: r.marca }, r.respostas);
}

/** A fila do Resumo novo: uma sugestão por vez, com a regra única do "já respondido". */
export function escolherSugestaoDoMes(r: RespostasDoMes, fila: Sugestao[], ctx: Omit<ContextoDaFila, "marca">): Sugestao | null {
  return escolherSugestao(fila, r.dispensas, { ...ctx, marca: r.marca }, (s) => sugestaoResolvida(r, s));
}

/**
 * O push e o e-mail do cron de avisos (lib/insights/alerts.ts) obedecem à mesma regra: o "Saúde
 * passou" (chave "2026-10:SAUDE:100"), o "já usou 80%" (":80") e a meta atrasada ("2026-10:goal:<id>")
 * não saem se ela já respondeu na tela. Outras chaves (meta que chegou lá) não são aviso a resolver.
 */
export function alertaResolvido(r: RespostasDoMes, chave: string): boolean {
  const partes = chave.split(":");
  if (partes.length !== 3) return false;
  const [, alvo, nivel] = partes;
  if (alvo === "goal") return resolvido(r, { tipo: "meta", metaId: nivel });
  if (nivel === "100") return categoriaResolvida(r, "estouro", alvo);
  if (nivel === "80") return categoriaResolvida(r, "ritmo", alvo);
  return false;
}
