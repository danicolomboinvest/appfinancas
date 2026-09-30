import Link from "next/link";
import { ChevronRight, Search, Check, ShoppingBag, ScanSearch, Signpost } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ReportarErro } from "@/components/decisoes/ReportarErro";
import { confirmarCancelamentoRaioXAction, escolherRitmoAction, responderCompraAmanhaAction } from "./actions";
import { carregarFoco, MESES } from "./dados";
import { AvisoFoco, CombinadoFoco } from "./AvisoFoco";
import { carregarBlocosDoMes } from "./blocos";
import { ThemeHero } from "@/app/(app)/mensal/[year]/[month]/ThemeHero";
import { MonthHighlight } from "@/app/(app)/mensal/[year]/[month]/MonthHighlight";
import { OnboardingChecklist } from "@/app/(app)/mensal/[year]/[month]/OnboardingChecklist";

/**
 * A aba Foco: a primeira coisa que a pessoa vê ao abrir o app. Só o que importa agora — quanto
 * está livre, no máximo três coisas que pedem atenção e o que está indo bem. O resto do mês
 * (gráficos, lançamentos) continua na Visão mensal, a abinha do lado.
 */
export default async function FocoPage() {
  const ctx = await getRequiredSession();
  const d = await carregarFoco(ctx);
  const blocos = await carregarBlocosDoMes(ctx, d.now);
  const mesTitulo = MESES[d.month - 1].charAt(0).toUpperCase() + MESES[d.month - 1].slice(1);
  const { t, m, foco, ritmo } = d;
  const livre = foco.livre;
  const cartaoAcao = "flex w-full items-center justify-between gap-4 text-left";

  return (
    <div className="flex flex-col gap-4">
      {!ritmo && (
        <Card className="p-5">
          <p className="text-body font-semibold text-ink">{t.focoRitmoPergunta}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(["semanal", "mensal"] as const).map((r) => (
              <form key={r} action={escolherRitmoAction.bind(null, r)}>
                <button type="submit" className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-hover">
                  <span className="block text-sm font-semibold text-ink">{r === "semanal" ? t.focoRitmoSemanal : t.focoRitmoMensal}</span>
                  <span className="mt-0.5 block text-caption text-ink-muted">{r === "semanal" ? t.focoRitmoSemanalSub : t.focoRitmoMensalSub}</span>
                </button>
              </form>
            ))}
          </div>
        </Card>
      )}

      {d.pendentes.map((p) => (
        <Card key={p.id} className="flex gap-4 p-5">
          <span className="w-1 shrink-0 rounded-full bg-accent" aria-hidden />
          <div className="min-w-0">
            <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Regra das 24 horas</p>
            <p className="mt-1 text-sm font-semibold text-ink">{t.focoAmanhaT(p.descricao ?? "Compra", m(Number(p.valor ?? 0)))}</p>
            <p className="mt-1 text-caption text-ink-muted">{t.focoAmanhaP}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={responderCompraAmanhaAction.bind(null, p.id, false)}>
                <button type="submit" className="rounded-xl bg-accent-soft px-3 py-1.5 text-caption font-semibold text-accent-strong">{t.focoAindaQuero}</button>
              </form>
              <form action={responderCompraAmanhaAction.bind(null, p.id, true)}>
                <button type="submit" className="rounded-xl border border-border px-3 py-1.5 text-caption font-semibold text-ink-muted">{t.compraDesisti}</button>
              </form>
            </div>
          </div>
        </Card>
      ))}

      {/* Janeiro a março: fechar o ano passado e escolher como começar este (com a sugestão ou do zero). */}
      {d.viradaPendente && (
        <Link href="/mensal/foco/ano">
          <Card className={`${cartaoAcao} p-5`}>
            <span>
              <span className="block text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Ano novo</span>
              <span className="mt-1 block text-sm font-semibold text-ink">
                Fechar {d.year - 1} e começar {d.year}
              </span>
              <span className="mt-0.5 block text-caption text-ink-muted">Seu ano em números e uma sugestão pra começar. 5 minutos.</span>
            </span>
            <span className="shrink-0 rounded-xl bg-pill px-3 py-2 text-caption font-semibold text-on-pill">{t.focoComecar}</span>
          </Card>
        </Link>
      )}

      {/* Lançamentos de antes da importação separar aplicação, fatura e estorno: revisar um por um. */}
      {d.lancamentosParaRevisar > 0 && (
        <Link href="/mensal/foco/revisar">
          <Card className={`${cartaoAcao} p-5`}>
            <span>
              <span className="block text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Números mais certos</span>
              <span className="mt-1 block text-sm font-semibold text-ink">
                {d.lancamentosParaRevisar === 1 ? "1 lançamento antigo parece aplicação, fatura ou estorno" : `${d.lancamentosParaRevisar} lançamentos antigos parecem aplicação, fatura ou estorno`}
              </span>
              <span className="mt-0.5 block text-caption text-ink-muted">Hoje eles contam como gasto ou renda. Revise em 2 minutos.</span>
            </span>
            <span className="shrink-0 rounded-xl bg-pill px-3 py-2 text-caption font-semibold text-on-pill">Revisar</span>
          </Card>
        </Link>
      )}

      {/* Um mês depois do "vou cancelar" do Raio-X: cancelou mesmo? Sim tira as cobranças futuras
          que já estavam lançadas; não pergunta de novo no mês que vem. */}
      {d.cancelamentos.map((c) => (
        <Card key={c.chave} className="p-5">
          <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{t.raioxTitulo}</p>
          <p className="mt-1 text-sm font-semibold text-ink">No mês passado você disse que ia cancelar {c.nome}. Cancelou?</p>
          <p className="mt-1 text-caption text-ink-muted">Se sim, eu tiro as próximas cobranças que já estavam lançadas.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={confirmarCancelamentoRaioXAction.bind(null, c.chave, true)}>
              <button type="submit" className="rounded-xl bg-pill px-3 py-1.5 text-caption font-semibold text-on-pill">Cancelei</button>
            </form>
            <form action={confirmarCancelamentoRaioXAction.bind(null, c.chave, false)}>
              <button type="submit" className="rounded-xl border border-border px-3 py-1.5 text-caption font-semibold text-ink-muted">Ainda não</button>
            </form>
          </div>
        </Card>
      ))}

      {ritmo === "mensal" && !d.fechamentoFeito && d.mesAnteriorTemDados && (
        <Link href="/mensal/foco/fechamento">
          <Card className={`${cartaoAcao} p-5`}>
            <span>
              <span className="block text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{t.focoFechEy}</span>
              <span className="mt-1 block text-sm font-semibold text-ink">{t.focoFechT(d.mesAnterior.label)}</span>
              <span className="mt-0.5 block text-caption text-ink-muted">{t.focoFechP}</span>
            </span>
            <span className="shrink-0 rounded-xl bg-pill px-3 py-2 text-caption font-semibold text-on-pill">{t.focoComecar}</span>
          </Card>
        </Link>
      )}
      {ritmo === "semanal" && !d.ritualFeito && (
        <Link href="/mensal/foco/ritual">
          <Card className={`${cartaoAcao} p-5`}>
            <span>
              <span className="block text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{t.focoRitualEy}</span>
              <span className="mt-1 block text-sm font-semibold text-ink">{t.focoRitualT}</span>
              <span className="mt-0.5 block text-caption text-ink-muted">{t.focoRitualP}</span>
            </span>
            <span className="shrink-0 rounded-xl bg-pill px-3 py-2 text-caption font-semibold text-on-pill">{t.focoComecar}</span>
          </Card>
        </Link>
      )}

      <OnboardingChecklist {...blocos.onboarding} />
      <ThemeHero dados={blocos.dadosDoTema} money={blocos.money} mesLabel={mesTitulo} />

      {livre.tipo === "semOrcamento" ? (
        <Card className="p-5">
          <p className="text-body font-semibold text-ink">{t.focoSemOrcamentoTitulo}</p>
          <p className="mt-1 text-caption text-ink-muted">{t.focoSemOrcamentoSub}</p>
          <Link href="/orcamento" className="mt-3 inline-flex rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-on-pill">
            {t.focoSemOrcamentoBotao}
          </Link>
        </Card>
      ) : (
        <Card className="p-5">
          <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">
            {livre.tipo === "estimativa" ? t.focoLivreEstimativa : livre.tipo === "semana" ? t.focoLivreSemana : t.focoLivreMes}
          </p>
          <p className="mt-1 text-[2.5rem] font-bold leading-none tracking-tight text-ink tabular-nums">{m(livre.valor)}</p>
          <p className="mt-1.5 text-caption text-ink-muted">
            {livre.tipo === "estimativa" ? t.focoLivreEstimativaSub(m(livre.porSemana)) : t.focoLivreSub}
          </p>
          {livre.tipo !== "estimativa" && (
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <div className="mb-1 flex justify-between text-caption text-ink-muted">
                  <span>{t.focoMesPassou}</span>
                  <span className="tabular-nums">{Math.round(livre.decorrido * 100)}%</span>
                </div>
                <ProgressBar percent={livre.decorrido} tone="neutral" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-caption text-ink-muted">
                  <span>{t.focoOrcamentoUsado}</span>
                  {/* Tudo que saiu ÷ orçamento: a mesma conta da Visão mensal. */}
                  <span className="tabular-nums">{Math.round((livre.gastoTotal / livre.planejado) * 100)}%</span>
                </div>
                <ProgressBar percent={livre.gastoTotal / livre.planejado} tone={livre.gastoTotal / livre.planejado > livre.decorrido + 0.1 ? "accent" : "success"} />
              </div>
            </div>
          )}
          {(livre.diasSemLancar !== null || livre.semGastoComData) && (
            <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-caption text-ink">
              {livre.diasSemLancar !== null ? t.focoDadosVelhos(livre.diasSemLancar) : t.focoDadosNenhum}
            </p>
          )}
          <details className="mt-4 border-t border-border pt-3">
            <summary className="cursor-pointer text-caption font-semibold text-accent-strong">{t.focoComoCheguei}</summary>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-caption">
              <dt className="text-ink-muted">Orçamento do mês</dt>
              <dd className="text-right tabular-nums text-ink">{m(livre.planejado)}</dd>
              {livre.tipo === "estimativa" ? (
                <>
                  <dt className="text-ink-muted">Dias que faltam</dt>
                  <dd className="text-right tabular-nums text-ink">
                    {livre.diasRestantes} de {d.diasNoMes}
                  </dd>
                  <dt className="font-semibold text-ink">Estimativa pelo planejado</dt>
                  <dd className="text-right font-semibold tabular-nums text-ink">{m(livre.restante)}</dd>
                </>
              ) : (
                <>
                  <dt className="text-ink-muted">Já gasto nas categorias do orçamento</dt>
                  <dd className="text-right tabular-nums text-ink">− {m(livre.gastoNoOrcamento)}</dd>
                  {livre.gastoTotal - livre.gastoNoOrcamento >= 1 && (
                    <>
                      <dt className="text-ink-muted">Gasto fora do orçamento</dt>
                      <dd className="text-right tabular-nums text-ink">− {m(livre.gastoTotal - livre.gastoNoOrcamento)}</dd>
                    </>
                  )}
                  <dt className="text-ink-muted">Sobra até o fim do mês</dt>
                  <dd className="text-right tabular-nums text-ink">{m(livre.restante)}</dd>
                  <dt className="text-ink-muted">Dias que faltam (com hoje)</dt>
                  <dd className="text-right tabular-nums text-ink">{livre.diasRestantes}</dd>
                  <dt className="font-semibold text-ink">Por semana</dt>
                  <dd className="text-right font-semibold tabular-nums text-ink">{m(livre.porSemana)}</dd>
                </>
              )}
            </dl>
            <p className="mt-2 text-caption text-ink-faint">
              {livre.tipo === "estimativa"
                ? "Ainda não há gasto lançado neste mês: suponho que você está gastando no ritmo do que planejou."
                : "Orçamento do mês menos tudo que já saiu, com ou sem categoria: o que estoura numa categoria e o que é gasto fora do orçamento saem do mesmo dinheiro. Contas que ainda vão vencer continuam guardadas nas categorias delas."}
            </p>
            <div className="mt-3">
              <ReportarErro tela="Foco: livre pra gastar" regra="(orçamento do mês − tudo que já saiu no mês) ÷ dias restantes × 7" />
            </div>
          </details>
        </Card>
      )}

      <h2 className="mt-2 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{t.focoAtencao}</h2>
      {foco.atencao.length === 0 ? (
        <Card className="p-5">
          <p className="text-body font-semibold text-ink">{t.focoNadaTitulo}</p>
          {t.focoNadaSub && <p className="mt-1 text-caption text-ink-muted">{t.focoNadaSub}</p>}
        </Card>
      ) : (
        foco.atencao.map((item) => <AvisoFoco key={item.id} item={item} hrefMes={d.hrefMes} opcoes={d.opcoesDeCategoria} gastos={item.detalhe?.tipo === "fora" ? d.gastosFora : item.detalhe?.tipo === "estouro" || item.detalhe?.tipo === "ritmo" ? (d.gastosPorCategoria[item.detalhe.categoria] ?? []) : []} resumo={item.detalhe?.tipo === "fora" ? d.resumoFora : item.detalhe?.tipo === "estouro" || item.detalhe?.tipo === "ritmo" ? d.resumoPorCategoria[item.detalhe.categoria] : undefined} />)
      )}
      {/* O que ela já decidiu num aviso vira combinado, logo abaixo: dá pra ver se está sendo cumprido. */}
      {foco.combinados.map((c) => (
        <CombinadoFoco key={c.categoria} c={c} hrefMes={d.hrefMes} opcoes={d.opcoesDeCategoria} gastos={d.gastosPorCategoria[c.categoria] ?? []} resumo={d.resumoPorCategoria[c.categoria]} />
      ))}
      {foco.depois.length > 0 && (
        <details>
          <summary className="cursor-pointer px-1 text-caption text-ink-muted">{t.focoMaisEsperam(foco.depois.length)}</summary>
          <div className="mt-3 flex flex-col gap-3">
            {foco.depois.map((item) => (
              <AvisoFoco key={item.id} item={item} hrefMes={d.hrefMes} opcoes={d.opcoesDeCategoria} gastos={item.detalhe?.tipo === "fora" ? d.gastosFora : item.detalhe?.tipo === "estouro" || item.detalhe?.tipo === "ritmo" ? (d.gastosPorCategoria[item.detalhe.categoria] ?? []) : []} resumo={item.detalhe?.tipo === "fora" ? d.resumoFora : item.detalhe?.tipo === "estouro" || item.detalhe?.tipo === "ritmo" ? d.resumoPorCategoria[item.detalhe.categoria] : undefined} />
            ))}
          </div>
        </details>
      )}

      {/* Central de decisões: as perguntas que o app responde com os números dela. Antes ficava
          só no "Mais", e o Foco parecia não levar a lugar nenhum. A empresa não tem Decidir. */}
      {!d.empresa && (
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Central de decisões</p>
            <p className="mt-1 text-sm font-semibold text-ink">Antes de decidir, pergunte pros seus números</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Link href="/decidir/comprar" className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 transition-colors hover:bg-surface-hover">
              <ShoppingBag size={18} className="shrink-0 text-accent-strong" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{t.compraTitulo}</span>
                <span className="block text-caption text-ink-muted">Cabe no mês? Parcelar ou à vista? Atrasa alguma meta?</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-ink-faint" />
            </Link>
            <Link href="/decidir/raio-x" className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 transition-colors hover:bg-surface-hover">
              <ScanSearch size={18} className="shrink-0 text-accent-strong" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{t.raioxTitulo}</span>
                <span className="block text-caption text-ink-muted">O que se repete todo mês e quanto isso dá no ano.</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-ink-faint" />
            </Link>
            <Link href="/decidir" className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 transition-colors hover:bg-surface-hover">
              <Signpost size={18} className="shrink-0 text-accent-strong" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">Todas as perguntas</span>
                <span className="block text-caption text-ink-muted">Financiar ou alugar, amortizar ou investir, e mais.</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-ink-faint" />
            </Link>
          </div>
        </Card>
      )}

      {ritmo === "semanal" && !d.fechamentoFeito && d.mesAnteriorTemDados && d.dia <= 15 && (
        <Link href="/mensal/foco/fechamento" className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-hover">
          <span>
            <span className="block text-sm font-semibold text-ink">{t.fechTitulo(d.mesAnterior.label)}</span>
            <span className="mt-0.5 block text-caption text-ink-muted">{t.focoFechP}</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-ink-faint" />
        </Link>
      )}

      {foco.fio && (
        <Card className="p-5">
          <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{t.focoFioTitulo}</p>
          <ol className="relative mt-3 flex flex-col gap-3 border-l-2 border-accent-soft pl-4">
            <li>
              <p className="text-caption text-ink-faint">Meta</p>
              <p className="text-sm font-semibold text-ink">
                {foco.fio.meta} · {foco.fio.quando}
              </p>
            </li>
            {foco.fio.guardarNoMes !== null && (
              <li>
                <p className="text-caption text-ink-faint">Este mês</p>
                <p className="text-sm font-semibold text-ink">
                  {t.fechAporteT(m(foco.fio.guardarNoMes))} ({m(foco.fio.guardadoNoMes)} feitos)
                </p>
              </li>
            )}
            {livre.tipo !== "semOrcamento" && (
              <li>
                <p className="text-caption text-ink-faint">{livre.tipo === "semana" ? "Esta semana" : "Até o fim do mês"}</p>
                <p className="text-sm font-semibold text-accent-strong">{m(livre.valor)} livres, sem mexer em nada acima</p>
              </li>
            )}
          </ol>
        </Card>
      )}

      {foco.bem.length > 0 && (
        <>
          <h2 className="mt-2 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{t.focoBem}</h2>
          <Card className="flex flex-col divide-y divide-border px-5 py-2">
            {foco.bem.map((b, i) => (
              <p key={i} className="flex items-center gap-3 py-3 text-sm font-medium text-ink">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check size={14} strokeWidth={2.5} />
                </span>
                {b.titulo}
              </p>
            ))}
          </Card>
        </>
      )}

      <MonthHighlight
        income={blocos.summary.totalIncome}
        expense={blocos.summary.totalExpense}
        investment={blocos.summary.totalInvestment}
        insights={blocos.insights}
        titulo={t.oQueMudou}
      />

      {!d.empresa && (
        <Link href="/decidir" className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-hover">
          <Search size={18} className="text-accent-strong" />
          <span className="text-sm font-semibold text-ink">{t.focoDuvida}</span>
          <ChevronRight size={16} className="ml-auto text-ink-faint" />
        </Link>
      )}

      <Link href={d.hrefMes} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-hover">
        <span>
          <span className="block text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{t.focoResumoMes(d.mesLabel)}</span>
          <span className="mt-0.5 block text-caption text-ink-muted">
            Entrou {m(d.summary.totalIncome)} · Gastou {m(d.summary.totalExpense)}
          </span>
        </span>
        <span className="shrink-0 text-caption font-semibold text-accent-strong">{t.focoVerMes} ›</span>
      </Link>

      {ritmo && (
        <form action={escolherRitmoAction.bind(null, ritmo === "semanal" ? "mensal" : "semanal")} className="flex items-center justify-center gap-2 pb-2 text-caption text-ink-faint">
          <span>{t.focoRitmoAtual(ritmo === "semanal")}</span>
          <button type="submit" className="font-semibold text-accent-strong underline-offset-2 hover:underline">
            {t.focoRitmoTrocar}
          </button>
        </form>
      )}
    </div>
  );
}

