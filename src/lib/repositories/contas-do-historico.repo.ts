import { prisma } from "@/lib/db/prisma";
import { hojeEmBrasilia } from "@/lib/contas/contas";
import { acharContas, jaCadastrada, proximoVencimento, type ContaAchada } from "@/lib/contas/achar-contas";
import { lancamentosParaCacar, type DonoDoPerfil } from "@/lib/repositories/dinheiro-perdido.repo";

/**
 * Contas do histórico (12/10/2026): grava no perfil as contas que o motor achou no extrato.
 *
 * - Nova: cadastra com origem "historico", todo mês, com lembrete, e o aviso ainda não visto.
 * - Já achada antes e ela não mexeu: atualiza valor e dia, e passa o vencimento para o próximo se
 *   a do mês já saiu no extrato.
 * - Ela editou: não toca mais. Ela apagou: a recusa segura, nunca volta (nem uma parecida, pelo
 *   nome e valor da apagada).
 * - Ela já tinha cadastrado (por nome, marca ou tipo com valor parecido): não duplica.
 */
export async function sincronizarContasDoHistorico(ctx: DonoDoPerfil, hoje = hojeEmBrasilia()): Promise<{ criadas: number; achadas: ContaAchada[] }> {
  const dono = { userId: ctx.userId, profileId: ctx.profileId };
  const [lancamentos, contas, recusas] = await Promise.all([
    lancamentosParaCacar(ctx),
    prisma.contaAPagar.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId },
      select: { id: true, nome: true, valor: true, vencimento: true, chaveDoHistorico: true, editadaPelaPessoa: true, quitada: true, aproximado: true, diaDoMes: true },
    }),
    prisma.contaRecusada.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, select: { chave: true, nome: true, valor: true } }),
  ]);
  const achadas = acharContas(lancamentos);
  if (achadas.length === 0) return { criadas: 0, achadas };
  const recusadas = new Set(recusas.map((r) => r.chave));
  const existentes = contas.map((c) => ({ nome: c.nome, valor: c.valor === null ? null : Number(c.valor), chaveDoHistorico: c.chaveDoHistorico }));
  // A apagada segura também a parecida: ela apagou o "Aluguel", o Pix do aluguel não entra no lugar.
  const parecidasComAsApagadas = recusas.filter((r) => r.nome).map((r) => ({ nome: r.nome!, valor: r.valor === null ? null : Number(r.valor) }));

  let criadas = 0;
  for (const a of achadas) {
    if (recusadas.has(a.chave)) continue;
    const minha = contas.find((c) => c.chaveDoHistorico === a.chave);
    if (minha) {
      if (minha.editadaPelaPessoa || minha.quitada) continue;
      // A do mês já saiu no extrato (ou o dia mudou): o vencimento anda para o próximo.
      const mesDoVencimento = minha.vencimento.toISOString().slice(0, 7);
      const saiu = minha.vencimento.getTime() < hoje.getTime() && a.mesesCobrados.includes(mesDoVencimento);
      const vencimento = saiu || minha.diaDoMes !== a.dia ? proximoVencimento(a.dia, hoje, a.mesesCobrados) : minha.vencimento;
      const mudou = Number(minha.valor) !== a.valor || minha.aproximado !== a.aproximado || minha.diaDoMes !== a.dia || vencimento.getTime() !== minha.vencimento.getTime();
      if (!mudou) continue;
      await prisma.contaAPagar.updateMany({
        where: { id: minha.id, userId: ctx.userId, profileId: ctx.profileId, editadaPelaPessoa: false },
        data: { valor: a.valor, aproximado: a.aproximado, diaDoMes: a.dia, vencimento, categoria: a.categoria },
      });
      continue;
    }
    if (jaCadastrada(a, existentes) || jaCadastrada(a, parecidasComAsApagadas)) continue;
    await prisma.contaAPagar.create({
      data: {
        ...dono,
        nome: a.nome,
        valor: a.valor,
        aproximado: a.aproximado,
        vencimento: proximoVencimento(a.dia, hoje, a.mesesCobrados),
        diaDoMes: a.dia,
        repete: true,
        lembrar: true,
        origem: "historico",
        chaveDoHistorico: a.chave,
        categoria: a.categoria,
      },
    });
    existentes.push({ nome: a.nome, valor: a.valor, chaveDoHistorico: a.chave });
    criadas += 1;
  }
  return { criadas, achadas };
}

/** As contas achadas que ela ainda não viu no aviso ("Achei N contas no seu histórico"). */
export async function listarContasNovasDoHistorico(ctx: DonoDoPerfil) {
  const linhas = await prisma.contaAPagar.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, origem: "historico", avisadaEm: null, tipo: null },
    select: { id: true, nome: true, valor: true, aproximado: true, diaDoMes: true },
    orderBy: { valor: "desc" },
  });
  return linhas.map((c) => ({ id: c.id, nome: c.nome, valor: c.valor === null ? null : Number(c.valor), aproximado: c.aproximado, dia: c.diaDoMes }));
}

/** Ela fechou o aviso: as achadas até aqui não aparecem mais nele. */
export async function fecharAvisoDasContas(ctx: DonoDoPerfil) {
  await prisma.contaAPagar.updateMany({ where: { userId: ctx.userId, profileId: ctx.profileId, origem: "historico", avisadaEm: null }, data: { avisadaEm: new Date() } });
}
