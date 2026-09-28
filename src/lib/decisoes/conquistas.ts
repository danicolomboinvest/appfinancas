/**
 * "O que você conquistou": soma só o que a pessoa DECIDIU dentro do app. Nunca "graças ao app" —
 * é o que ela fez. Compra desistida conta o valor da compra; decisão do Raio-X conta a economia
 * por ano; ritual e fechamento contam a constância.
 *
 * Puro, sem banco.
 */

export type DecisaoRegistrada = { tipo: string; valor: number | null; createdAt: Date };

export type Conquistas = {
  decisoes: number;
  desistidas: number;
  comprasPensadas: number;
  raioxAnual: number;
  rituais: number;
  fechamentos: number;
  desde: Date | null;
};

const QUE_CONTAM = new Set(["compra_desisti", "compra_comprei", "ritual", "fechamento", "teto", "raiox_cancelar", "raiox_metade", "raiox_manter"]);

export function somarConquistas(decisoes: DecisaoRegistrada[]): Conquistas {
  const c: Conquistas = { decisoes: 0, desistidas: 0, comprasPensadas: 0, raioxAnual: 0, rituais: 0, fechamentos: 0, desde: null };
  for (const d of decisoes) {
    if (!QUE_CONTAM.has(d.tipo)) continue;
    c.decisoes += 1;
    if (!c.desde || d.createdAt < c.desde) c.desde = d.createdAt;
    if (d.tipo === "compra_desisti") c.desistidas += d.valor ?? 0;
    if (d.tipo === "compra_desisti" || d.tipo === "compra_comprei") c.comprasPensadas += 1;
    if (d.tipo === "raiox_cancelar" || d.tipo === "raiox_metade") c.raioxAnual += d.valor ?? 0;
    if (d.tipo === "ritual") c.rituais += 1;
    if (d.tipo === "fechamento") c.fechamentos += 1;
  }
  return c;
}
