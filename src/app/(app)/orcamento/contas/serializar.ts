import type { ContaDaTela } from "@/lib/repositories/conta-a-pagar.repo";
import type { ContaSerial } from "./LinhaDaConta";

export const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Datas viram texto pra atravessar pro cliente. O "pago em" é um instante: vira o dia de Brasília. */
export function serializarConta(c: ContaDaTela): ContaSerial {
  return { ...c, vencimento: iso(c.vencimento), pagaEm: c.pagaEm ? iso(new Date(c.pagaEm.getTime() - 3 * 3_600_000)) : null };
}
