import { createHash } from "node:crypto";

/**
 * Fechar o mês a dois (proposta aprovada, tela f): cada um diz "Confere"; o mês fecha quando os
 * dois conferiram. Se alguém lança ou muda um lançamento do mês depois do primeiro "Confere", as
 * confirmações caem e o aviso diz o porquê.
 *
 * Em vez de pendurar um gatilho em cada lugar que grava lançamento (são muitos: digitar, falar,
 * importar, recorrente, Open Finance), cada "Confere" guarda uma assinatura dos lançamentos que
 * entram no acerto. Na hora de mostrar, a assinatura de agora é comparada com a guardada.
 */

export type LinhaDaAssinatura = { id: string; amount: number | string; category: string; pessoa: string | null; doCasal: boolean | null };

export function assinaturaDoMes(linhas: LinhaDaAssinatura[]): string {
  const partes = linhas
    .map((l) => `${l.id}|${Number(l.amount).toFixed(2)}|${l.category}|${l.pessoa ?? ""}|${l.doCasal === false ? 0 : 1}`)
    .sort();
  return createHash("sha256").update(partes.join("\n")).digest("hex");
}

export type Fechamento = { confereA: Date | null; confereB: Date | null; assinaturaA: string | null; assinaturaB: string | null; fechadoEm: Date | null };

export type EstadoDoFechamento =
  | { tipo: "ninguem" }
  | { tipo: "falta-um"; conferiu: "A" | "B"; falta: "A" | "B" }
  | { tipo: "mudou"; quem: ("A" | "B")[] }
  | { tipo: "fechado"; em: Date };

export function estadoDoFechamento(f: Fechamento | null, assinaturaAtual: string): EstadoDoFechamento {
  if (!f) return { tipo: "ninguem" };
  const valeA = Boolean(f.confereA && f.assinaturaA === assinaturaAtual);
  const valeB = Boolean(f.confereB && f.assinaturaB === assinaturaAtual);
  if (valeA && valeB) {
    const em = f.fechadoEm ?? new Date(Math.max(f.confereA!.getTime(), f.confereB!.getTime()));
    return { tipo: "fechado", em };
  }
  const caiu: ("A" | "B")[] = [];
  if (f.confereA && !valeA) caiu.push("A");
  if (f.confereB && !valeB) caiu.push("B");
  if (caiu.length > 0) return { tipo: "mudou", quem: caiu };
  if (valeA) return { tipo: "falta-um", conferiu: "A", falta: "B" };
  if (valeB) return { tipo: "falta-um", conferiu: "B", falta: "A" };
  return { tipo: "ninguem" };
}

/** O mês que está para fechar: o anterior ao de hoje (o mês corrente ainda está acontecendo). */
export function mesParaFechar(hoje: { ano: number; mes: number }): { ano: number; mes: number } {
  return hoje.mes === 1 ? { ano: hoje.ano - 1, mes: 12 } : { ano: hoje.ano, mes: hoje.mes - 1 };
}
