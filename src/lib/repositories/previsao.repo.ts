import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { parcelasDoMes, type ContaParcelada } from "@/lib/contas/parcelas-do-mes";
import { listarLancamentosParcelaveis } from "@/lib/repositories/monthly-entry.repo";
import { listarRecusasDeParcela } from "@/lib/repositories/parcelas.repo";
import { mesesAte, valoresDosMeses } from "@/lib/consolidation/seis-meses";
import { TIPO_ASSINATURA } from "@/lib/contas/assinaturas";
import { nomeDoCartao } from "@/lib/cartao/bancos";
import { parseInstallment } from "@/lib/entries/recurrence";
import { cartaoNoMes, contasNoMes, doIndiceDoMes, type GastoNoCartao, indiceDoMes, montarMesPrevisto, rendaMedia, type ContaPrevista, type Mes, type MesPrevisto } from "@/lib/previsao/proximos-meses";

/**
 * Os meses que ainda não chegaram, com o que já está previsto em cada um (ver
 * lib/previsao/proximos-meses.ts). `de` é o primeiro mês futuro; `n`, quantos.
 */
export async function carregarMesesPrevistos(ctx: AuthContext, hoje: Mes, de: Mes, n: number): Promise<MesPrevisto[]> {
  const meses = Array.from({ length: n }, (_, i) => doIndiceDoMes(indiceDoMes(de) + i));
  const [parcelaveis, recusas, contas, valores, noCartao] = await Promise.all([
    // A janela das parcelas vai 12 meses para frente do mês de agora: cobre os 6 do seletor.
    listarLancamentosParcelaveis(ctx, { year: hoje.ano, month: hoje.mes }),
    listarRecusasDeParcela(ctx),
    prisma.contaAPagar.findMany({
      where: { ...doDono(ctx), quitada: false },
      select: { id: true, nome: true, valor: true, vencimento: true, diaDoMes: true, repete: true, intervalo: true, unidade: true, mesesEscolhidos: true, parcelas: true, parcelaAtual: true, categoria: true, tipo: true },
      take: 300,
    }),
    // A renda média: os 3 meses fechados antes do de agora.
    valoresDosMeses(ctx, mesesAte(hoje.mes === 1 ? hoje.ano - 1 : hoje.ano, hoje.mes === 1 ? 12 : hoje.mes - 1, 3)),
    // O que já está no cartão nesses meses (a compra no cartão e a fatura contam no mês da fatura).
    prisma.monthlyEntry.findMany({
      where: {
        userId: ctx.userId, profileId: ctx.profileId,
        category: "EXPENSE",
        OR: meses.map((m) => ({ year: m.ano, month: m.mes })),
        AND: [{ OR: [{ cartaoId: { not: null } }, { noCartao: true }, { noCartao: null, importBatch: { docType: "fatura" } }] }],
      },
      select: { year: true, month: true, amount: true, description: true, cartao: { select: { banco: true, apelido: true } } },
    }),
  ]);
  const gastosNoCartao: GastoNoCartao[] = noCartao.map((g) => ({ year: g.year, month: g.month, amount: Number(g.amount), description: g.description, cartao: g.cartao ? `Cartão ${nomeDoCartao(g.cartao)}` : null }));
  const ehParcela = (d: string | null) => Boolean(parseInstallment(d ?? "")?.confident);
  const media = rendaMedia(valores.sort((a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes)).map((v) => v.entrou));
  const lista: ContaPrevista[] = contas.map((c) => ({
    nome: c.nome,
    valor: c.valor === null ? null : Number(c.valor),
    vencimento: c.vencimento.toISOString().slice(0, 10),
    repete: c.repete,
    intervalo: c.intervalo,
    unidade: c.unidade,
    mesesEscolhidos: c.mesesEscolhidos ?? [],
    parcelas: c.parcelas,
    assinatura: c.tipo === TIPO_ASSINATURA,
  }));
  const parceladas: ContaParcelada[] = contas
    .filter((c) => (c.parcelas ?? 0) > 1)
    .map((c) => ({ id: c.id, nome: c.nome, valor: c.valor === null ? null : Number(c.valor), parcelas: c.parcelas, parcelaAtual: c.parcelaAtual, categoria: (c.categoria as string | null) ?? null, diaDoMes: c.diaDoMes, vencimento: c.vencimento.toISOString().slice(0, 10) }));
  const parcelasDe = (m: Mes) => parcelasDoMes(parcelaveis, { year: m.ano, month: m.mes }, parceladas, recusas).itens;

  return Array.from({ length: n }, (_, i) => {
    const m = doIndiceDoMes(indiceDoMes(de) + i);
    const antes = doIndiceDoMes(indiceDoMes(m) - 1);
    const doMes = contasNoMes(lista, m);
    return montarMesPrevisto(m, {
      parcelas: parcelasDe(m).map((p) => ({ nome: p.nome, valor: p.valor })),
      contas: doMes.contas,
      assinaturas: doMes.assinaturas,
      cartao: cartaoNoMes(gastosNoCartao, m, ehParcela),
      acabaram: parcelasDe(antes)
        .filter((p) => p.acabaEm.year === antes.ano && p.acabaEm.month === antes.mes)
        .map((p) => ({ nome: p.nome, valor: p.valor })),
      rendaMedia: media,
    });
  });
}
