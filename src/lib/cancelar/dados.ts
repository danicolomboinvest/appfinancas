import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Compra } from "@/lib/assinatura/compra";
import { dataLonga, renovacaoEm } from "@/lib/assinatura/renovacao";
import { nowInBrazil } from "@/lib/date/brazil-now";
import type { DadosDoCancelar } from "@/app/(app)/configuracoes/_ajustes/CancelarAssinatura";
import { dentroDoReembolso, fimDoReembolso, ofertaDisponivel, type TipoDePedido } from "./regras";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** O que a folha "antes de cancelar" precisa: a renovação, o prazo do reembolso e o que ainda vale. */
export async function dadosDoCancelar(userId: string, compra: Compra): Promise<DadosDoCancelar> {
  const hoje = nowInBrazil();
  const pedidos = await prisma.pedidoAntesDeCancelar.findMany({ where: { userId }, select: { tipo: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  const ultimo = (t: TipoDePedido) => pedidos.find((p) => p.tipo === t)?.createdAt ?? null;
  const tipos: TipoDePedido[] = ["meses_gratis", "duvida", "contestacao", "aviso_renovacao", "conversa", "aviso_reembolso"];
  const fim = fimDoReembolso(compra.em);
  return {
    via: compra.via,
    renovaEm: dataLonga(renovacaoEm(compra.em, hoje)),
    reembolsoAte: compra.via === "site" && dentroDoReembolso(compra.em, hoje) ? `${fim.getUTCDate()} de ${MESES[fim.getUTCMonth()]}` : null,
    disponivel: Object.fromEntries(tipos.map((t) => [t, ofertaDisponivel(ultimo(t), hoje)])) as Record<TipoDePedido, boolean>,
  };
}
