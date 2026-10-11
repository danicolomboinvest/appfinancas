import Link from "next/link";
import { redirect } from "next/navigation";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { ondeMostrarFechamento } from "./fechamento/quando-mostrar";
import type { ReactNode } from "react";
import { CalendarCheck, ChevronRight, Check } from "lucide-react";
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
import { DecisoesImportantes } from "./DecisoesImportantes";
import { textosDoFechamento } from "./fechamento/estado";
import { GraficoSeisMeses } from "@/components/charts/GraficoSeisMeses";
import { mesesAte, montarMeses, valoresDosMeses } from "@/lib/consolidation/seis-meses";
import { lerSobrou, mesSemLancamento, sobrouDoResumo } from "@/lib/consolidation/sobrou";
import { planoApertado } from "@/lib/decisoes/posso-comprar";
import { categoriasEssenciais } from "@/lib/categories";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { Explica } from "@/components/ui/Explica";
import { ContaDoLivre } from "./ContaDoLivre";
import { diaDaSemana, fimDoMesPeloPlano, livreAteDomingo, ritmoDoMes } from "@/lib/decisoes/foco-semana";
import { vozDoTema } from "@/lib/profiles/voice";
import { listarContasAPagar } from "@/lib/repositories/conta-a-pagar.repo";
import { contasDoFoco, hojeEmBrasilia } from "@/lib/contas/contas";
import { iso, serializarConta } from "@/app/(app)/orcamento/contas/serializar";
import { ContasDoFoco } from "./ContasDoFoco";
import { CartaoMoneyReset } from "./CartaoMoneyReset";
import { ConquistasDeMetas } from "@/components/conquista/ConquistasDeMetas";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { lerReset } from "@/lib/repositories/money-reset.repo";

/**
 * A aba Foco: a primeira coisa que a pessoa vê ao abrir o app. Só o que importa agora — quanto
 * está livre, no máximo três coisas que pedem atenção e o que está indo bem. O resto do mês
 * (gráficos, lançamentos) continua na Visão mensal, a abinha do lado.
 */
export default async function FocoPage() {
  const ctx = await getRequiredSession();
  // A Empresa tem a Visão geral dela (versão nova, 11/10/2026): recibo do mês, Vendas, Despesas e Contas.
  if (ehEmpresa(ctx.profileKind)) redirect("/empresa");
  const [d, contas] = await Promise.all([carregarFoco(ctx), listarContasAPagar(ctx)]);
  const [blocos, valoresMeses] = await Promise.all([carregarBlocosDoMes(ctx, d.now), valoresDosMeses(ctx, mesesAte(d.year, d.month, 12))]);
  const meses12 = montarMeses(valoresMeses, { ano: d.year, mes: d.month }, 12);
  const hoje = hojeEmBrasilia();
  const contasDaSemana = contasDoFoco(contas, hoje);
  const mesTitulo = MESES[d.month - 1].charAt(0).toUpperCase() + MESES[d.month - 1].slice(1);
  const { t, m, foco, ritmo } = d;
  // Quem nunca escolheu o ritmo conta como mensal: sem isso a iniciante nunca via o fechamento.
  const ondeFechar = ondeMostrarFechamento({ ritmo, fechamentoFeito: d.fechamentoFeito, mesAnteriorTinhaPlano: d.mesAnteriorTinhaPlano, dia: d.dia });
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

  // O Foco em níveis (07/10/2026). A análise que a Dani trouxe: "tudo quer a atenção ao mesmo tempo;
  // onde eu olho?". Antes eram até dez cartões do mesmo peso (24 horas, Money Reset, contas, ano novo,
  // revisar, cancelamentos, fechamento, ritual, avisos, pergunta do ritmo). Agora:
  //   1. o número livre (o herói), com uma frase do que acontece se seguir assim;
  //   2. "Atenção hoje": UM problema (conta vencendo, categoria estourando, compra esperando as 24h);
  //   3. "Próxima ação": UMA tarefa (Money Reset, fechamento, ritual, ano novo, revisar…);
  //   4. o resto num "Mais N coisas", fechado. Nada sumiu: só não grita junto.
  // O que a folha "O que fazer?" usa para sugerir de onde tirar (remanejo por prioridade).
  const remanejo = {
    categorias: d.categorias.map((c) => ({ key: c.key, label: c.label, planejado: c.planejado, gasto: c.gasto })),
    essenciais: [...categoriasEssenciais(ctx.categorias?.prefs)],
    livre: livre.tipo === "semOrcamento" ? null : livre.restante,
    diasRestantes: livre.tipo === "semOrcamento" ? 1 : livre.diasRestantes,
  };
  const avisoNo = (item: (typeof foco.atencao)[number]) => (
    <AvisoFoco
      key={item.id}
      item={item}
      remanejo={remanejo}
      hrefMes={d.hrefMes}
      opcoes={d.opcoesDeCategoria}
      gastos={item.detalhe?.tipo === "fora" ? d.gastosFora : item.detalhe?.tipo === "estouro" || item.detalhe?.tipo === "ritmo" ? (d.gastosPorCategoria[item.detalhe.categoria] ?? []) : []}
      resumo={item.detalhe?.tipo === "fora" ? d.resumoFora : item.detalhe?.tipo === "estouro" || item.detalhe?.tipo === "ritmo" ? d.resumoPorCategoria[item.detalhe.categoria] : undefined}
    />
  );

  const problemas: { chave: string; no: ReactNode }[] = [];
  // Conta vencendo é o que mais custa esquecer (juros, multa): sempre a primeira.
  if (contasDaSemana.length > 0) {
    problemas.push({
      chave: "contas",
      no: <ContasDoFoco contas={contasDaSemana.map(serializarConta)} atrasadas={contasDaSemana.filter((c) => c.situacao === "atrasada").length} hoje={iso(hoje)} />,
    });
  }
  // Os avisos (categoria que passou, meta atrasada, reserva curta) moram em "Decisões importantes".
  const decisoes = [...foco.atencao, ...foco.depois];
  for (const p of d.pendentes) {
    problemas.push({
      chave: `24h-${p.id}`,
      no: (
        <Card className="flex gap-4 p-5">
          <span className="w-1 shrink-0 rounded-full bg-accent" aria-hidden />
          <div className="min-w-0">
            <p className="text-caption font-semibold text-ink-muted">Regra das 24 horas</p>
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
      ),
    });
  }

  const tarefas: { chave: string; no: ReactNode }[] = [];
  // Money Reset: a missão de hoje, só para quem comprou e ainda não terminou os 21 dias.
  if (!contaNova && (await temMoneyReset(ctx.userId)) && (await lerReset(ctx)).estado.fase !== "concluido") {
    tarefas.push({ chave: "money-reset", no: <CartaoMoneyReset ctx={ctx} t={t} /> });
  }
  const tarefa = (chave: string, href: string, ey: string, titulo: string, botao: string) =>
    tarefas.push({
      chave,
      no: (
        <Link href={href}>
          <Card className={`${cartaoAcao} p-3.5`}>
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent-strong" aria-hidden>
                <CalendarCheck size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-snug text-ink">{titulo}</span>
                <span className="mt-0.5 block text-caption text-ink-muted">{ey}</span>
              </span>
            </span>
            <span className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-pill px-4 text-sm font-semibold text-on-pill">{botao}</span>
          </Card>
        </Link>
      ),
    });
  if (ondeFechar === "destaque") tarefa("fechamento", "/mensal/foco/fechamento", t.focoFechEy, t.focoFechT(d.mesAnterior.label), t.focoComecar);
  if (ritmo === "semanal" && !d.ritualFeito) tarefa("ritual", "/mensal/foco/ritual", t.focoRitualEy, t.focoRitualT, t.focoComecar);
  if (d.viradaPendente) tarefa("ano", "/mensal/foco/ano", "Ano novo", `Fechar ${d.year - 1} e começar ${d.year}`, t.focoComecar);
  if (d.lancamentosParaRevisar > 0) {
    tarefa(
      "revisar",
      "/mensal/foco/revisar",
      "Números mais certos",
      d.lancamentosParaRevisar === 1 ? "1 lançamento antigo parece aplicação, fatura ou estorno" : `${d.lancamentosParaRevisar} lançamentos antigos parecem aplicação, fatura ou estorno`,
      "Revisar",
    );
  }
  for (const c of d.cancelamentos) {
    tarefas.push({
      chave: `cancelou-${c.chave}`,
      no: (
        <Card className="p-5">
          <p className="text-caption font-semibold text-ink-muted">{t.raioxTitulo}</p>
          <p className="mt-1 text-sm font-semibold text-ink">No mês passado você disse que ia cancelar {c.nome}. Cancelou?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={confirmarCancelamentoRaioXAction.bind(null, c.chave, true)}>
              <button type="submit" className="rounded-xl bg-pill px-3 py-1.5 text-caption font-semibold text-on-pill">Cancelei</button>
            </form>
            <form action={confirmarCancelamentoRaioXAction.bind(null, c.chave, false)}>
              <button type="submit" className="rounded-xl border border-border px-3 py-1.5 text-caption font-semibold text-ink-muted">Ainda não</button>
            </form>
          </div>
        </Card>
      ),
    });
  }
  // Semanal ou mensal? Só depois do primeiro lançamento (antes disso vale o semanal, em silêncio).
  if (perguntarRitmo(ritmo !== null, comece.temLancamento)) {
    tarefas.push({
      chave: "ritmo",
      no: (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-ink">{t.focoRitmoPergunta}</p>
          <div className="grid grid-cols-2 gap-2">
            {(["semanal", "mensal"] as const).map((r) => (
              <form key={r} action={escolherRitmoAction.bind(null, r)}>
                <button type="submit" className="min-h-11 w-full rounded-full border border-border-strong px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-hover">
                  {r === "semanal" ? t.focoRitmoSemanal : t.focoRitmoMensal}
                </button>
              </form>
            ))}
          </div>
        </div>
      ),
    });
  }
  if (ondeFechar === "discreto") {
    tarefas.push({
      chave: "fechamento-discreto",
      no: (
        <Link href="/mensal/foco/fechamento" className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-hover">
          <span className="text-sm font-semibold text-ink">{t.fechTitulo(d.mesAnterior.label)}</span>
          <ChevronRight size={16} className="shrink-0 text-ink-faint" />
        </Link>
      ),
    });
  }
  const resto = [...problemas.slice(1), ...tarefas.slice(1)];
  // O mês passado fechado: uma linha discreta para o resumão (rodada 42).
  const textosFechamento = textosDoFechamento(d.fechamento.estado, d.mesAnterior.month, d.fechamento.em);
  const apertado = d.empresa ? null : planoApertado({ renda: d.rendaDoMes, gastoPlanejado: livre.tipo === "semOrcamento" ? 0 : livre.planejado, regra90: ctx.profileKind !== "CASAL" });
  const sobrouAgora = lerSobrou(sobrouDoResumo(d.summary), mesSemLancamento(d.summary));
  const quadro = [
    { rotulo: voz.titulos.entrou, valor: d.summary.totalIncome, cor: "var(--color-dinheiro-entrou)", fundo: "" },
    { rotulo: voz.titulos.gastou, valor: d.summary.totalExpense, cor: "var(--color-dinheiro-gastou)", fundo: "" },
    { rotulo: "Guardou", valor: d.summary.totalInvestment, cor: "var(--color-dinheiro-guardou)", fundo: "" },
    { rotulo: sobrouAgora.rotulo, valor: sobrouAgora.valor, cor: sobrouAgora.situacao === "faltou" ? "var(--color-dinheiro-faltou)" : "var(--color-dinheiro-sobrou)", fundo: sobrouAgora.situacao === "faltou" ? "bg-[color-mix(in_srgb,var(--color-dinheiro-faltou)_12%,var(--color-surface))]" : "bg-[color-mix(in_srgb,var(--color-dinheiro-sobrou)_12%,var(--color-surface))]" },
  ];
  const mesAteAgora = (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="titulo-tema text-lg font-medium text-ink">{mesTitulo} até agora</h2>
        <Explica>Sobrou é o que entrou menos o que você gastou e o que guardou. Uma conta só, a mesma do gráfico.</Explica>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {quadro.map((q) => (
          <Link key={q.rotulo} href={d.hrefMes} className={`flex min-w-0 flex-col gap-2 rounded-3xl border border-border p-4 ${q.fundo || "bg-surface"}`}>
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              <span className="size-2 shrink-0 rounded-full" style={{ background: q.cor }} aria-hidden />
              {q.rotulo}
            </span>
            <ValorDestaque texto={m(q.valor)} className="text-[1.5rem] font-light leading-none tracking-[-0.02em] tabular-nums text-ink" />
          </Link>
        ))}
      </div>
    </section>
  );

  // O que vai bem e o "tudo em dia": a última linha da tela.
  const emDia = problemas.length === 0 && livre.tipo !== "semOrcamento";
  const selo =
    !emDia && foco.bem.length === 0
      ? null
      : (() => {
          const indoBem = foco.bem.length === 0 ? null : foco.bem.length === 1 ? "1 coisa indo bem" : `${foco.bem.length} coisas indo bem`;
          const rotulo = [emDia ? t.focoNadaTitulo : null, indoBem].filter(Boolean).join(", ");
          const linha = (
            <span className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Check size={14} strokeWidth={2.5} />
              </span>
              {rotulo}
            </span>
          );
          return foco.bem.length === 0 ? (
            <div className="flex justify-center px-4">{linha}</div>
          ) : (
            <details className="px-1">
              <summary className="cursor-pointer list-none">{linha}</summary>
              <ul className="flex flex-col divide-y divide-border pb-2 pl-8">
                {foco.bem.map((b, i) => (
                  <li key={i} className="py-2.5 text-sm text-ink-muted">
                    {b.titulo}
                  </li>
                ))}
              </ul>
            </details>
          );
        })();

  return (
    // Celular: uma coluna, na ordem dos níveis. Computador: à esquerda o número, os atalhos e o mês;
    // à direita o que pede atenção, a próxima ação e o selo.
    <div className={`flex flex-col gap-5 ${contaNova ? "" : "lg:grid lg:grid-cols-2 lg:items-start lg:gap-6"}`}>
      <div className="flex min-w-0 flex-col gap-5">
        {/* Meta que chegou no valor: a notificação com confete, uma vez só (conquista rara). */}
        <ConquistasDeMetas ctx={ctx} />
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
              <ContaDoLivre
                titulo={t.focoComoCheguei}
                conta={
                  <div className="text-ink">
                    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-caption">
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
                          <dt className="text-ink-muted">Por dia</dt>
                          <dd className="text-right tabular-nums text-ink">{m(livre.restante / Math.max(1, livre.diasRestantes))}</dd>
                          <dt className="font-semibold text-ink">Até domingo ({Math.min(diaDaSemana(d.now).diasAteDomingo, livre.diasRestantes)} dias)</dt>
                          <dd className="text-right font-semibold tabular-nums text-ink">{m(livre.porSemana)}</dd>
                        </>
                      )}
                    </dl>
                    <p className="mt-2 text-caption text-ink-faint">
                      {livre.tipo === "estimativa"
                        ? "Ainda não há gasto lançado: suponho que você gasta no ritmo do plano."
                        : "Orçamento do mês menos tudo que já saiu, com ou sem categoria."}
                    </p>
                    <div className="mt-3">
                      <ReportarErro tela="Foco: livre pra gastar" regra="(orçamento do mês − tudo que já saiu no mês) ÷ dias restantes × 7" />
                    </div>
                  </div>
                }
              >
              <SemanaFoco
                rotulos={{ porDia: t.focoPorDia, fimDoMes: t.focoFimDoMes }}
                // Mês ainda sem lançamento (quem acompanha uma vez por mês, no começo do mês): o mesmo
                // desenho aprovado, "Livre até domingo", com o número do PLANO para esta semana e o
                // "Fim do mês" pelo plano. Antes caía num "Livre no mês (estimativa)" com barra vazia.
                rotulo={livre.tipo === "estimativa" || livre.tipo === "semana" ? t.focoLivreSemana : t.focoLivreMes}
                valor={livre.tipo === "estimativa" ? livreAteDomingo(livre.restante, livre.diasRestantes, diaDaSemana(d.now).diasAteDomingo) : livre.valor}
                fimDoMesDoPlano={livre.tipo === "estimativa" ? fimDoMesPeloPlano(d.rendaPlanejada, livre.planejado, d.aportePlanejado) : null}
                tipo={livre.tipo}
                hoje={d.now}
                ritmo={ritmoAtual}
                frase={voz.ritmo[ritmoAtual]}
                planejado={livre.planoVariavel}
                gastoTotal={livre.tipo === "estimativa" ? 0 : livre.gastoVariavel}
                gastoUnico={livre.tipo === "estimativa" ? 0 : livre.gastoUnico}
                decorrido={livre.tipo === "estimativa" ? 0 : livre.decorrido}
                diasRestantes={livre.diasRestantes}
                money={m}
              >
                {(livre.tipo === "estimativa" || livre.diasSemLancar !== null || livre.semGastoComData) && (
                  <p className="rounded-xl bg-surface/70 px-3 py-2 text-caption text-ink">
                    {livre.tipo !== "estimativa" && livre.diasSemLancar !== null ? t.focoDadosVelhos(livre.diasSemLancar) : t.focoDadosNenhum}
                  </p>
                )}
              </SemanaFoco>
              </ContaDoLivre>
            )}
          </>
        )}

        <OnboardingChecklist
          temLancamento={comece.temLancamento}
          temOrcamento={comece.temOrcamento}
          primeiroLancamentoEm={comece.primeiroLancamentoEm?.toISOString() ?? null}
          hrefMes={d.hrefMes}
        />

        {!contaNova && (
          <>
            {/* O mesmo número da pilha do Decidir (rodadas 38 e 49): tocar abre a pilha. A empresa,
                que não tem Decidir, continua vendo a lista aqui mesmo. */}
            {d.empresa ? (
              <DecisoesImportantes quantas={decisoes.length}>{decisoes.map((item) => avisoNo(item))}</DecisoesImportantes>
            ) : (
              <DecisoesImportantes quantas={foco.atencao.length} href="/decidir" />
            )}
            {/* Plano apertado (regra 3.8): o plano de gastos já usa 90% ou mais da renda. */}
            {apertado && (
              <p className="rounded-2xl px-4 py-3 text-sm text-ink" style={{ background: "color-mix(in srgb, var(--color-dinheiro-faltou) 12%, var(--color-surface))" }}>
                {apertado.texto}{" "}
                <Link href={apertado.atalho.href} className="font-medium text-accent-strong underline-offset-2 hover:underline">
                  {apertado.atalho.rotulo}
                </Link>
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {/* Conta nova (nenhum lançamento ainda): o Foco é só o "Comece por aqui". */}
        {contaNova ? (
          <Link href="/guia" className="flex min-h-11 items-center justify-center gap-1 px-2 text-center text-caption text-ink-muted underline-offset-2 hover:text-ink hover:underline">
            {t.focoComeceManual}
            <ChevronRight size={14} className="shrink-0" />
          </Link>
        ) : (
          <>
            {mesAteAgora}
            <GraficoSeisMeses meses12={meses12} />
            {d.fechamento.estado === "fechado" && (
              // "Setembro fechado. Ver resumo" (rodada 42): a linha discreta no lugar do cartão.
              <p className="flex min-h-11 items-center gap-2 px-1 text-sm text-ink-muted">
                <CalendarCheck size={16} className="shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">{textosFechamento.titulo}.</span>
                <Link href="/mensal/foco/fechamento" className="shrink-0 text-ink underline underline-offset-2">
                  Ver resumo
                </Link>
              </p>
            )}
            {/* "Para hoje" (07/10/2026): o alerta e a próxima ação num bloco só, com um título em
                letra normal. Eram dois rótulos em caixa alta, "Atenção hoje" e "Próxima ação". */}
            {(problemas.length > 0 || tarefas.length > 0) && (
              <section className="flex flex-col gap-2.5">
                <h2 className="px-1 text-base font-semibold text-ink">{t.focoParaHoje}</h2>
                {problemas[0]?.no}
                {tarefas[0]?.no}
              </section>
            )}


            {resto.length > 0 && (
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-1 text-sm font-medium text-ink-muted hover:text-ink">
                  <ChevronRight size={16} className="transition-transform group-open:rotate-90" aria-hidden />
                  {t.focoMaisCoisas(resto.length)}
                </summary>
                <div className="mt-2 flex flex-col gap-3">
                  {resto.map((r) => (
                    <div key={r.chave}>{r.no}</div>
                  ))}
                </div>
              </details>
            )}

            {/* Acompanhando: o que ela combinou consigo mesma, logo depois do que pede ação. */}
            {foco.combinados.map((c) => (
              <CombinadoFoco key={c.categoria} c={c} hrefMes={d.hrefMes} opcoes={d.opcoesDeCategoria} gastos={d.gastosPorCategoria[c.categoria] ?? []} resumo={d.resumoPorCategoria[c.categoria]} />
            ))}


            {selo}

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
    </div>
  );
}
