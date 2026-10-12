import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import type { Compra } from "@/lib/assinatura/compra";
import { dataLonga, renovacaoEm } from "@/lib/assinatura/renovacao";
import { nowInBrazil } from "@/lib/date/brazil-now";
import type { DadosDoCancelar } from "@/app/(app)/configuracoes/_ajustes/CancelarAssinatura";
import { dentroDoReembolso, fimDoReembolso, ofertaDisponivel, type TipoDePedido } from "./regras";
import { prazoComPresente } from "./presente";
import { ateAgora, contraOPreco, type EstadoDoAchado } from "@/lib/dinheiro-perdido/placar";
import { MOEDA_DO_PRECO_DO_SPI, PRECO_DO_SPI_POR_ANO } from "@/lib/dinheiro-perdido/config";
import { getUserCurrency } from "@/lib/money-server";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * O que a folha "antes de cancelar" precisa: a renovação, até quando o acesso vale, o prazo do
 * reembolso, o que ainda pode ser oferecido e os maiores lançamentos de este mês e do passado
 * (para marcar no "Algo não está certo").
 */
export async function dadosDoCancelar(ctx: AuthContext, compra: Compra): Promise<DadosDoCancelar> {
  const hoje = nowInBrazil();
  const renova = renovacaoEm(compra.em, hoje);
  const ate = compra.acessoAte && compra.acessoAte > renova ? compra.acessoAte : renova;
  const meses = [0, 1].map((k) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - k, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const [pedidos, lancs, achados, moeda] = await Promise.all([
    prisma.pedidoAntesDeCancelar.findMany({ where: { userId: ctx.userId }, select: { tipo: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", OR: meses },
      select: { id: true, description: true, subcategory: true, amount: true, year: true, month: true, entryDate: true },
      orderBy: { amount: "desc" },
      take: 200,
    }),
    // O que o Dinheiro perdido já devolveu neste perfil (dado de dinheiro sempre filtra pelo perfil).
    prisma.achadoDinheiroPerdido.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, estado: { in: ["nao_uso", "estornado"] } }, select: { mensal: true, unico: true, estado: true } }),
    getUserCurrency(),
  ]);
  const recuperado = ateAgora(achados.map((a) => ({ mensal: a.mensal === null ? null : Number(a.mensal), unico: a.unico === null ? null : Number(a.unico), estado: a.estado as EstadoDoAchado })));
  const ultimo = (t: TipoDePedido) => pedidos.find((p) => p.tipo === t)?.createdAt ?? null;
  const tipos: TipoDePedido[] = ["meses_gratis", "duvida", "contestacao", "aviso_renovacao", "conversa", "aviso_reembolso"];
  const fim = fimDoReembolso(compra.em);
  return {
    via: compra.via,
    recuperado: recuperado.porAno > 0 ? { porAno: recuperado.porAno, jaSePagou: moeda === MOEDA_DO_PRECO_DO_SPI && contraOPreco(recuperado.porAno, PRECO_DO_SPI_POR_ANO).pagou } : null,
    renovaEm: dataLonga(renova),
    acessoAte: dataLonga(ate),
    presenteAte: dataLonga(prazoComPresente(compra.acessoAte, renova)),
    reembolsoAte: compra.via === "site" && dentroDoReembolso(compra.em, hoje) ? `${fim.getUTCDate()} de ${MESES[fim.getUTCMonth()]}` : null,
    disponivel: Object.fromEntries(tipos.map((t) => [t, ofertaDisponivel(ultimo(t), hoje)])) as Record<TipoDePedido, boolean>,
    meses: meses.map(({ year, month }) => ({
      chave: `${year}-${String(month).padStart(2, "0")}`,
      rotulo: MESES[month - 1].charAt(0).toUpperCase() + MESES[month - 1].slice(1),
      lancamentos: lancs
        .filter((l) => l.year === year && l.month === month)
        .slice(0, 6)
        .map((l) => ({ id: l.id, nome: l.description || l.subcategory || "Lançamento", valor: Number(l.amount), dia: l.entryDate ? l.entryDate.getUTCDate() : null })),
    })),
  };
}
