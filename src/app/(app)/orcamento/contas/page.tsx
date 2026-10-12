import Link from "next/link";
import { ChevronRight, Repeat } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { hojeEmBrasilia } from "@/lib/contas/contas";
import { listarContasAPagar, listarQuitadasRecentes } from "@/lib/repositories/conta-a-pagar.repo";
import { listBudgets } from "@/lib/repositories/budget.repo";
import { listarDividas, selicAnual } from "@/lib/repositories/divida.repo";
import { saudeDe, SELIC_DE_RESERVA } from "@/lib/dividas/saude";
import { perfilDoTipo } from "@/lib/dividas/tipos";
import { LogoDoCredor } from "@/app/(app)/dividas/partes";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { carregarRaioX } from "@/app/(app)/mensal/foco/dados";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { serverMoney } from "@/lib/money-server";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { Explica } from "@/components/ui/Explica";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { ContasAPagar, ContasDoAno } from "./ContasAPagar";
import { FolhaDasContas } from "./folha-contexto";
import { pesoPorMes, vencimentosDaJanela } from "@/lib/contas/recorrentes";
import { SemanaDasContas } from "./SemanaDasContas";
import { iso, serializarConta } from "./serializar";
import { carregarDinheiroPerdido } from "./perdido/dados";
import { EntradaDoDinheiroPerdido } from "./perdido/Entrada";

/**
 * Recorrentes, a quarta aba da Visão geral (versão nova, protótipo aprovado): quanto da renda já
 * tem dono (contas e assinaturas), o que sai nesta semana, as contas com o "paguei", as
 * assinaturas achadas no extrato e o limite do cartão. `?nova=1` abre o formulário de conta.
 *
 * "Dívidas por mês" (fase 2): o que sai por mês para cada dívida, só leitura, com "Ver plano".
 *
 * Dinheiro perdido (12/10/2026): a abinha no alto leva às cartas (./perdido).
 *
 * Fase 3 (seção 3.17): a semana navegável com cada vencimento, a frequência livre, o valor
 * aproximado e as contas do ano (guarde R$ X por mês). A conta reconhecida no extrato fica para
 * a conciliação, que é outra entrega.
 */
export default async function RecorrentesPage(props: PageProps<"/orcamento/contas">) {
  const sp = await props.searchParams;
  const ctx = await getRequiredSession();
  const money = await serverMoney();
  const m = (v: number) => money(v, { round: true });
  const agora = nowInBrazil();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const empresa = ehEmpresa(ctx.profileKind);
  const [abertas, pagas, plano, resumo, planoDoMes, raiox, dividas, selic, perdido] = await Promise.all([
    listarContasAPagar(ctx),
    listarQuitadasRecentes(ctx),
    listBudgets(ctx, ano, mes),
    getMonthlySummary(ctx, ano, mes),
    getMonthlyPlan(ctx, ano, mes),
    empresa ? Promise.resolve({ itens: [], decididos: new Set<string>() }) : carregarRaioX(ctx, ano, mes),
    empresa ? Promise.resolve([]) : listarDividas(ctx),
    empresa ? Promise.resolve(null) : selicAnual(ctx.userId),
    // Dinheiro perdido: só a abinha (quantas cartas e os logos). A Empresa não tem.
    empresa ? Promise.resolve(null) : carregarDinheiroPerdido(ctx),
  ]);
  const hojeD = hojeEmBrasilia();
  const hoje = iso(hojeD);
  const contas = abertas.map(serializarConta);
  const renda = planoDoMes && planoDoMes.plannedIncome > 0 ? planoDoMes.plannedIncome : resumo.totalIncome;
  // Renda com dono: contas pela média por mês (a diarista a cada 2 semanas pesa R$ 390), parcelas
  // pelo valor da parcela, assinaturas achadas no extrato. As contas do ano têm o card delas.
  const peso = pesoPorMes(contas, hojeD);
  const assinaturas = raiox.itens.filter((i) => i.tipo === "assinatura");
  const totalAssinaturas = assinaturas.reduce((s, i) => s + i.mensal, 0);
  const planejado = plano.reduce((s, b) => s + Number(b.plannedAmount), 0);
  const livre = planejado > 0 ? planejado - resumo.totalExpense : null;
  const comDono = peso.contas + peso.parcelas + totalAssinaturas;
  const pct = renda > 0 ? Math.round((comDono / renda) * 100) : null;
  const largura = (v: number) => `${Math.min(100, (v / renda) * 100)}%`;
  const vencimentos = vencimentosDaJanela(contas, hojeD, 30).map((v) => ({ chave: v.chave, id: v.id, nome: v.nome, valor: v.valor, aproximado: v.aproximado, vencimento: v.dia }));

  return (
    <FolhaDasContas hoje={hoje} abrirNova={sp.nova === "1"}>
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        {perdido && <EntradaDoDinheiroPerdido abertas={perdido.abertas} novos={perdido.novos} />}
        {pct !== null && (
          <HeroiDoTema>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] text-heroi-suave">Renda com dono</p>
              <Explica noHeroi>Quanto da renda do mês já tem destino antes do dia a dia: contas (pela média por mês), parcelas e assinaturas.</Explica>
            </div>
            <ValorDestaque texto={`${pct}%`} />
            <div className="flex h-2 gap-px overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)]">
              <span className="h-full bg-[var(--color-heroi-tinta)]" style={{ width: largura(peso.contas) }} />
              <span className="h-full bg-[color-mix(in_srgb,var(--color-heroi-tinta)_65%,transparent)]" style={{ width: largura(peso.parcelas) }} />
              <span className="h-full bg-[color-mix(in_srgb,var(--color-heroi-tinta)_40%,transparent)]" style={{ width: largura(totalAssinaturas) }} />
            </div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm">
              <div className="flex justify-between gap-2"><dt className="flex items-center gap-1.5 text-heroi-suave"><i className="size-2 rounded-full bg-[var(--color-heroi-tinta)]" aria-hidden />Contas</dt><dd className="tabular-nums">{m(peso.contas)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="flex items-center gap-1.5 text-heroi-suave"><i className="size-2 rounded-full bg-[color-mix(in_srgb,var(--color-heroi-tinta)_65%,transparent)]" aria-hidden />Parcelas</dt><dd className="tabular-nums">{m(peso.parcelas)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="flex items-center gap-1.5 text-heroi-suave"><i className="size-2 rounded-full bg-[color-mix(in_srgb,var(--color-heroi-tinta)_40%,transparent)]" aria-hidden />Assinaturas</dt><dd className="tabular-nums">{m(totalAssinaturas)}</dd></div>
              {livre !== null && <div className="flex justify-between gap-2"><dt className="flex items-center gap-1.5 text-heroi-suave"><i className="size-2 rounded-full bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)] shadow-[inset_0_0_0_1px_var(--color-heroi-tinta)]" aria-hidden />Livre</dt><dd className="tabular-nums">{m(livre)}</dd></div>}
            </dl>
            {(dividas.length > 0 || peso.parcelas > 0) && <p className="text-[13px] text-heroi-suave">As parcelas já estão dentro do seu plano.</p>}
          </HeroiDoTema>
        )}
        <SemanaDasContas contas={vencimentos} hoje={hoje} />
        <ContasAPagar contas={contas} pagas={pagas.map(serializarConta)} hoje={hoje} />
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        {assinaturas.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h2 className="titulo-tema text-lg font-medium text-ink">Assinaturas</h2>
              <span className="text-sm tabular-nums text-ink-muted">{money(totalAssinaturas)} por mês</span>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
              {assinaturas.map((a) => (
                <li key={a.chave} className="flex items-center gap-3 px-3 py-3">
                  <LogoDoLancamento descricao={a.nome} icon={Repeat} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] text-ink">{a.nome}</span>
                    <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                      Mensal <span className="rounded-full bg-surface-2 px-2 py-px text-xs">do extrato</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[16px] tabular-nums text-ink">{money(a.mensal)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {dividas.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="titulo-tema text-lg font-medium text-ink">
                Dívidas <span className="text-sm font-normal text-ink-muted">por mês</span>
              </h2>
              <Link href="/dividas?plano=1" className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-4 text-sm text-ink">
                Ver plano <ChevronRight size={16} strokeWidth={1.8} aria-hidden />
              </Link>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
              {dividas.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-3">
                  <LogoDoCredor credor={d.credor} tipo={d.tipo} saude={saudeDe(d, selic ?? SELIC_DE_RESERVA)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] text-ink">{d.nome}</span>
                    <span className="block text-[13px] text-ink-muted">{d.diaVencimento ? `todo dia ${d.diaVencimento}` : perfilDoTipo(d.tipo).nome}</span>
                  </span>
                  <span className="shrink-0 text-[16px] tabular-nums text-ink">{m(d.porMes)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* O protótipo termina em Contas do ano; o limite do cartão mora em Configurações › Contas e cartões. */}
        <ContasDoAno contas={contas} hoje={hoje} />
      </div>
    </div>
    </FolhaDasContas>
  );
}
