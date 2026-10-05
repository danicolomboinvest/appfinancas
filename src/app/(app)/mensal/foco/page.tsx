import Link from "next/link";
import { ondeMostrarFechamento } from "./fechamento/quando-mostrar";
import { ChevronRight, Check, ShoppingBag, ScanSearch, Signpost } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { ReportarErro } from "@/components/decisoes/ReportarErro";
import { confirmarCancelamentoRaioXAction, escolherRitmoAction, responderCompraAmanhaAction } from "./actions";
import { carregarFoco, MESES } from "./dados";
import { AvisoFoco, CombinadoFoco } from "./AvisoFoco";
import { carregarBlocosDoMes } from "./blocos";
import { ThemeHero } from "@/app/(app)/mensal/[year]/[month]/ThemeHero";
import { OnboardingChecklist } from "@/app/(app)/mensal/[year]/[month]/OnboardingChecklist";
import { perguntarRitmo } from "./comece";
import { SemanaFoco } from "./SemanaFoco";
import { ritmoDoMes } from "@/lib/decisoes/foco-semana";
import { vozDoTema } from "@/lib/profiles/voice";
import { listarContasAPagar } from "@/lib/repositories/conta-a-pagar.repo";
import { contasDoFoco, hojeEmBrasilia } from "@/lib/contas/contas";
import { iso, serializarConta } from "@/app/(app)/orcamento/contas/serializar";
import { ContasDoFoco } from "./ContasDoFoco";
import { CartaoMoneyReset } from "./CartaoMoneyReset";
import { ConquistasDeMetas } from "@/components/conquista/ConquistasDeMetas";

/**
 * A aba Foco: a primeira coisa que a pessoa vê ao abrir o app. Só o que importa agora — quanto
 * está livre, no máximo três coisas que pedem atenção e o que está indo bem. O resto do mês
 * (gráficos, lançamentos) continua na Visão mensal, a abinha do lado.
 */
export default async function FocoPage() {
  const ctx = await getRequiredSession();
  const [d, contas] = await Promise.all([carregarFoco(ctx), listarContasAPagar(ctx)]);
  const blocos = await carregarBlocosDoMes(ctx, d.now);
  const hoje = hojeEmBrasilia();
  const contasDaSemana = contasDoFoco(contas, hoje);
  const mesTitulo = MESES[d.month - 1].charAt(0).toUpperCase() + MESES[d.month - 1].slice(1);
  const { t, m, foco, ritmo } = d;
  // Quem nunca escolheu o ritmo conta como mensal: sem isso a iniciante nunca via o fechamento.
  const ondeFechar = ondeMostrarFechamento({ ritmo, fechamentoFeito: d.fechamentoFeito, mesAnteriorTemDados: d.mesAnteriorTemDados, dia: d.dia });
  const livre = foco.livre;
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  // O que já correu do orçamento contra o quanto do mês já passou, sem as contas fixas: com elas,
  // o aluguel do dia 1 fazia todo começo de mês parecer "gastando rápido demais" (05/10/2026).
  const ritmoAtual =
    (livre.tipo === "semana" || livre.tipo === "mes") && livre.planoVariavel > 0
      ? ritmoDoMes(livre.gastoVariavel / livre.planoVariavel, livre.decorrido)
      : "dentro";
  const comece = blocos.onboarding;
  const contaNova = !comece.temLancamento;
  const cartaoAcao = "flex w-full items-center justify-between gap-4 text-left";

  return (
    <div className="flex flex-col gap-4">
      {/* Meta que chegou no valor: a notificação com confete, uma vez só (conquista rara). */}
      <ConquistasDeMetas ctx={ctx} />
      {/* O topo da Foco é a pergunta da semana (01/10/2026): antes ficava abaixo do fechamento e
          da pergunta do ritmo, e o número que importa era o terceiro bloco. */}
      {!contaNova && (
        <>
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
            <SemanaFoco
              rotulo={livre.tipo === "estimativa" ? t.focoLivreEstimativa : livre.tipo === "semana" ? t.focoLivreSemana : t.focoLivreMes}
              valor={livre.valor}
              tipo={livre.tipo}
              hoje={d.now}
              ritmo={ritmoAtual}
              frase={voz.ritmo[ritmoAtual]}
              planejado={livre.planoVariavel}
              gastoTotal={livre.tipo === "estimativa" ? 0 : livre.gastoVariavel}
              decorrido={livre.tipo === "estimativa" ? 0 : livre.decorrido}
              diasRestantes={livre.diasRestantes}
              money={m}
            >
              {(livre.diasSemLancar !== null || livre.semGastoComData) && (
                <p className="rounded-xl bg-surface/70 px-3 py-2 text-caption text-ink">
                  {livre.diasSemLancar !== null ? t.focoDadosVelhos(livre.diasSemLancar) : t.focoDadosNenhum}
                </p>
              )}
              <details className="border-t border-ink/10 pt-3">
                <summary className="cursor-pointer text-caption font-semibold text-ink-muted">{t.focoComoCheguei}</summary>
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
            </SemanaFoco>
          )}

        </>
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

      {/* Money Reset: a missão de hoje, só para quem comprou (o resto nem vê). */}
      <CartaoMoneyReset ctx={ctx} t={t} />

      {/* Conta vencendo é o que mais custa esquecer (juros, multa): logo abaixo do número da semana. */}
      <ContasDoFoco
        contas={contasDaSemana.map(serializarConta)}
        atrasadas={contasDaSemana.filter((c) => c.situacao === "atrasada").length}
        hoje={iso(hoje)}
      />

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

      {ondeFechar === "destaque" && (
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

      <OnboardingChecklist
        temLancamento={comece.temLancamento}
        temOrcamento={comece.temOrcamento}
        primeiroLancamentoEm={comece.primeiroLancamentoEm?.toISOString() ?? null}
        hrefMes={d.hrefMes}
      />

      {/* Conta nova (nenhum lançamento ainda): o Foco é só o "Comece por aqui". Livre pra gastar,
          avisos, Central de decisões e resumo do mês estariam zerados, e o "Nada pedindo
          atenção" fazia quem não fez nada achar que já estava tudo certo. */}
      {contaNova ? (
        <Link href="/guia" className="flex min-h-11 items-center justify-center gap-1 px-2 text-center text-caption text-ink-muted underline-offset-2 hover:text-ink hover:underline">
          {t.focoComeceManual}
          <ChevronRight size={14} className="shrink-0" />
        </Link>
      ) : (
        <>
          {(foco.atencao.length > 0 || livre.tipo !== "semOrcamento") && (
            <h2 className="mt-2 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{t.focoAtencao}</h2>
          )}
          {foco.atencao.length === 0 ? (
            livre.tipo !== "semOrcamento" && (
              <Card className="p-5">
                <p className="text-body font-semibold text-ink">{t.focoNadaTitulo}</p>
                {t.focoNadaSub && <p className="mt-1 text-caption text-ink-muted">{t.focoNadaSub}</p>}
              </Card>
            )
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

          {/* Semanal ou mensal? Só depois do primeiro lançamento: antes disso é uma decisão sem
              nada pra acompanhar (enquanto isso vale o semanal, em silêncio, como em dados.ts). */}
          {perguntarRitmo(ritmo !== null, comece.temLancamento) && (
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

          {/* "Nada pedindo atenção" só quando dá pra saber: sem orçamento não há o que conferir, e a
              frase soava como "tudo certo" pra quem ainda não montou nada. */}
          {/* Central de decisões em pílulas (01/10/2026): antes era um cartão de três linhas com
              explicação cada; as perguntas já dizem o que fazem. A empresa não tem Decidir. */}
          {!d.empresa && (
            <section className="flex flex-col gap-2">
              <p className="px-1 text-caption font-medium text-ink-muted">Antes de decidir, pergunte</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: "/decidir/comprar", icone: ShoppingBag, rotulo: t.compraTitulo },
                  { href: "/decidir/raio-x", icone: ScanSearch, rotulo: t.raioxTitulo },
                  { href: "/decidir", icone: Signpost, rotulo: "Todas as perguntas" },
                ].map(({ href, icone: Icone, rotulo }) => (
                  <Link key={href} href={href} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-hover">
                    <Icone size={16} className="text-accent-strong" aria-hidden />
                    {rotulo}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {ondeFechar === "discreto" && (
            <Link href="/mensal/foco/fechamento" className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-hover">
              <span>
                <span className="block text-sm font-semibold text-ink">{t.fechTitulo(d.mesAnterior.label)}</span>
                <span className="mt-0.5 block text-caption text-ink-muted">{t.focoFechP}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-ink-faint" />
            </Link>
          )}

          {/* O que vai bem cabe numa linha: aberta, a lista de sempre. */}
          {foco.bem.length > 0 && (
            <details className="rounded-2xl border border-border bg-surface px-4">
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check size={14} strokeWidth={2.5} />
                </span>
                {foco.bem.length === 1 ? "1 coisa indo bem" : `${foco.bem.length} coisas indo bem`}
              </summary>
              <ul className="flex flex-col divide-y divide-border pb-2">
                {foco.bem.map((b, i) => (
                  <li key={i} className="py-2.5 text-sm text-ink-muted">
                    {b.titulo}
                  </li>
                ))}
              </ul>
            </details>
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
        </>
      )}
    </div>
  );
}

