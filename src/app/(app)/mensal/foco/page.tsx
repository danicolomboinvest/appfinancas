import Link from "next/link";
import { CartaoMoneyReset } from "./CartaoMoneyReset";
import { redirect } from "next/navigation";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { ondeMostrarFechamento } from "./fechamento/quando-mostrar";
import { CalendarCheck } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { carregarFoco, MESES } from "./dados";
import { AvisoFoco } from "./AvisoFoco";
import { carregarBlocosDoMes } from "./blocos";
import { ThemeHero } from "@/app/(app)/mensal/[year]/[month]/ThemeHero";
import { SemanaFoco } from "./SemanaFoco";
import { DecisoesImportantes } from "./DecisoesImportantes";
import { GraficoSeisMeses } from "@/components/charts/GraficoSeisMeses";
import { mesesAte, montarMeses, valoresDosMeses } from "@/lib/consolidation/seis-meses";
import { categoriasEssenciais } from "@/lib/categories";
import { ContaDoLivre } from "./ContaDoLivre";
import { QuadroDoMes } from "./QuadroDoMes";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { serverMoney } from "@/lib/money-server";
import { lerIntervalo, lerMesEscolhido, mesDeAgora, mesmoMes } from "@/lib/visao-geral/periodo";
import { ResumoDoPeriodo } from "./ResumoDoPeriodo";
import { fimDoMesPeloPlano, previsaoDoMes, ritmoDoMes } from "@/lib/decisoes/foco-semana";
import { ComoChegamos } from "./ComoChegamos";
import { vozDoTema } from "@/lib/profiles/voice";
import { ConquistasDeMetas } from "@/components/conquista/ConquistasDeMetas";
import { lerComecoDaConta } from "@/lib/repositories/comeco.repo";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { mostrarPrimeirosPassos, oQueMostrarDepois } from "@/lib/onboarding/comeco";
import { ComecoDoMes, PrimeirosPassos, TopoDoComeco } from "./DepoisDoComeco";
import { acertoDaCasa } from "@/lib/repositories/casa.repo";
import { casaNaTela } from "@/lib/casa/regras";
import { DuasBolinhas } from "@/components/casa/Pessoas";
import { CartaoAcerto } from "./CartaoAcerto";

/**
 * A aba Foco: a primeira coisa que a pessoa vê ao abrir o app. Só o que importa agora — quanto
 * está livre, no máximo três coisas que pedem atenção e o que está indo bem. O resto do mês
 * (gráficos, lançamentos) continua na Visão mensal, a abinha do lado.
 */
export default async function FocoPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getRequiredSession();
  // A Empresa tem a Visão geral dela (versão nova, 11/10/2026): recibo do mês, Vendas, Despesas e Contas.
  if (ehEmpresa(ctx.profileKind)) redirect("/empresa");
  // Tudo de uma vez (o Resumo esperava o Foco para só depois buscar o mês e os 6 meses).
  const agora = nowInBrazil();
  // Outro mês no seletor da Visão geral: o quadro daquele mês e os 6 meses (o "livre até domingo"
  // e as decisões só existem para o mês de agora).
  const busca = await props.searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const intervalo = lerIntervalo({ periodo: um(busca.periodo), de: um(busca.de), ate: um(busca.ate) }, agora);
  if (intervalo) return <ResumoDoPeriodo ctx={ctx} intervalo={intervalo} agora={agora} />;
  const escolhido = lerMesEscolhido(busca.mes, agora);
  // Outro mês (protótipo): o herói da semana e as Decisões importantes continuam em cima; muda o
  // quadro do mês e, no mês passado ainda aberto, aparece "Setembro ainda não foi fechado".
  const outroMes = mesmoMes(escolhido, mesDeAgora(agora)) ? null : escolhido;
  // Casal simples: o acerto do mês que está na tela (o de agora ou o escolhido no seletor).
  const mesDoAcerto = outroMes ?? mesDeAgora(agora);
  const casa = casaNaTela(ctx.casa);
  const [d, blocos, valoresMeses, resumoOutro, moneyR, acerto] = await Promise.all([
    carregarFoco(ctx),
    carregarBlocosDoMes(ctx, agora),
    valoresDosMeses(ctx, mesesAte(agora.getFullYear(), agora.getMonth() + 1, 12)),
    outroMes ? getMonthlySummary(ctx, outroMes.ano, outroMes.mes) : Promise.resolve(null),
    serverMoney(),
    casa ? acertoDaCasa(ctx, mesDoAcerto.ano, mesDoAcerto.mes) : Promise.resolve(null),
  ]);
  const meses12 = montarMeses(valoresMeses, { ano: d.year, mes: d.month }, 12);
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
  // O começo da versão nova (onboarding): quem entrou por ele vê o "aha" ou o convite no topo e os
  // Primeiros passos no lugar do "Comece por aqui". Quem já usava o app (sem começo) segue igual.
  const [comecoNovo, conta] = await Promise.all([lerComecoDaConta(ctx.userId), getOwnUser(ctx)]);
  const nomeDoComeco = comecoNovo?.apelido || conta.name?.trim().split(/\s+/)[0] || "você";
  const topoDoComeco = comecoNovo ? oQueMostrarDepois(comecoNovo, comece.temLancamento) : "nada";
  const passosDoComeco = comecoNovo && mostrarPrimeirosPassos(comecoNovo);
  // Com o "aha" ou o convite, os passos vêm depois do livre; sem eles, no topo.
  const passosNoTopo = passosDoComeco && topoDoComeco === "nada" && !contaNova;
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

  // Os avisos (categoria que passou, meta atrasada, reserva curta) moram em "Decisões importantes".
  const decisoes = [...foco.atencao, ...foco.depois];
  // O Resumo é o do protótipo (11/10/2026, pedido da dona): herói, Decisões importantes, o mês até
  // agora, os 6 meses e, em "Para hoje", só o "Fechar <mês>" quando é hora. Saíram daqui as contas
  // da semana (moram em Recorrentes), o Money Reset (fica fora até a dona reformular), o "Mais N
  // coisinhas", o selo "indo bem", o plano apertado e a linha do ritmo.
  const fecharMes =
    ondeFechar === "destaque" || ondeFechar === "discreto" ? (
      <Link href="/mensal/foco/fechamento">
        <Card className={`${cartaoAcao} p-3.5`}>
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent-strong" aria-hidden>
              <CalendarCheck size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-snug text-ink">{t.focoFechT(d.mesAnterior.label)}</span>
              <span className="mt-0.5 block text-caption text-ink-muted">{t.focoFechEy}</span>
            </span>
          </span>
          <span className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-pill px-4 text-sm font-semibold text-on-pill">{t.focoComecar}</span>
        </Card>
      </Link>
    ) : null;
  const redondo = (v: number) => moneyR(v, { round: true });
  const nomeOutro = outroMes ? MESES[outroMes.mes - 1].charAt(0).toUpperCase() + MESES[outroMes.mes - 1].slice(1) + (outroMes.ano === agora.getFullYear() ? "" : ` de ${outroMes.ano}`) : "";
  const mesAteAgora =
    outroMes && resumoOutro ? (
      <QuadroDoMes titulo={nomeOutro} resumo={resumoOutro} href={`/mensal/${outroMes.ano}/${outroMes.mes}`} rotulos={{ entrou: voz.titulos.entrou, gastou: voz.titulos.gastou }} money={redondo} aoLadoDoTitulo={casa ? <DuasBolinhas casa={casa} /> : undefined} />
    ) : (
      <QuadroDoMes titulo={`${mesTitulo} até agora`} resumo={d.summary} href={d.hrefMes} rotulos={{ entrou: voz.titulos.entrou, gastou: voz.titulos.gastou }} money={redondo} aoLadoDoTitulo={casa ? <DuasBolinhas casa={casa} /> : undefined} />
    );
  const ehMesPassado = outroMes !== null && outroMes.ano === d.mesAnterior.year && outroMes.mes === d.mesAnterior.month;
  const avisoNaoFechado =
    ehMesPassado && !d.fechamentoFeito ? (
      <Link href="/mensal/foco/fechamento" className="flex items-center gap-3 rounded-3xl bg-accent-soft px-4 py-3" data-mes-nao-fechado>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent-strong" aria-hidden>
          <CalendarCheck size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-medium text-ink">{d.mesAnterior.label.charAt(0).toUpperCase() + d.mesAnterior.label.slice(1)} ainda não foi fechado</b>
          <small className="text-[13px] text-ink-muted">3 min</small>
        </span>
        <span className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface">Fechar</span>
      </Link>
    ) : null;

  return (
    // Celular: uma coluna, na ordem dos níveis. Computador: à esquerda o número, os atalhos e o mês;
    // à direita o que pede atenção, a próxima ação e o selo.
    <div className={`flex flex-col gap-5 ${contaNova ? "" : "lg:grid lg:grid-cols-2 lg:items-start lg:gap-6"}`}>
      <div className="flex min-w-0 flex-col gap-5">
        {avisoNaoFechado}
        {/* Meta que chegou no valor: a notificação com confete, uma vez só (conquista rara). */}
        <ConquistasDeMetas ctx={ctx} />
        {/* Sem nenhum lançamento: os dois cartões do começo, os Primeiros passos e o Como funciona. */}
        {contaNova && <ComecoDoMes ctx={ctx} comeco={comecoNovo} mes={MESES[d.month - 1]} hrefMes={d.hrefMes} />}
        {comecoNovo && !contaNova && topoDoComeco !== "nada" && <TopoDoComeco ctx={ctx} comeco={comecoNovo} nome={nomeDoComeco} temLancamento={comece.temLancamento} />}
        {comecoNovo && passosNoTopo && <PrimeirosPassos ctx={ctx} comeco={comecoNovo} hrefMes={d.hrefMes} />}
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
              <ContaDoLivre titulo={t.focoComoCheguei} conta={<ComoChegamos livre={livre} money={m} rendaSoOQueEntrou={d.rendaSoOQueEntrou} />}>
                <SemanaFoco
                  rotulos={{ porDia: t.focoPorDia, fimDoMes: t.focoFimDoMes, comoChegamos: t.focoComoCheguei }}
                  // Regra A (13/10/2026): o valor da semana é fixo, o número grande é o que ainda cabe
                  // nele (ou quanto passou). O mesmo para quem acompanha por semana ou por mês.
                  rotulo={t.focoLivreSemana}
                  semana={livre.semana}
                  estimativa={livre.tipo === "estimativa"}
                  guardar={livre.renda !== null && (livre.guardar ?? 0) >= 1 ? livre.guardar : null}
                  fimDoMes={livre.tipo === "estimativa" ? fimDoMesPeloPlano(d.rendaPlanejada, livre.planejado, d.aportePlanejado) : previsaoDoMes(livre.planoVariavel, livre.gastoVariavel, livre.decorrido, livre.gastoUnico)}
                  hoje={d.now}
                  ritmo={ritmoAtual}
                  frase={voz.ritmo[ritmoAtual]}
                  money={m}
                >
                  {livre.tipo !== "estimativa" && livre.diasSemLancar !== null ? (
                    <p className="rounded-xl bg-surface/70 px-3 py-2 text-caption text-ink">{t.focoDadosVelhos(livre.diasSemLancar)}</p>
                  ) : livre.tipo === "estimativa" || livre.semGastoComData ? (
                    <p className="rounded-xl bg-surface/70 px-3 py-2 text-caption text-ink">{t.focoDadosNenhum}</p>
                  ) : d.faltaOCartao ? (
                    // Usa cartão e o último gasto dele é de mais de 7 dias: a fatura ainda não veio.
                    <p className="rounded-xl bg-surface/70 px-3 py-2 text-caption text-ink" data-falta-cartao>
                      Falta o cartão desde {d.faltaOCartao.mes === d.month ? `dia ${d.faltaOCartao.dia}` : `${d.faltaOCartao.dia}/${String(d.faltaOCartao.mes).padStart(2, "0")}`}. O número pode estar alto.
                    </p>
                  ) : null}
                </SemanaFoco>
              </ContaDoLivre>
            )}
          </>
        )}

        {comecoNovo && !contaNova && passosDoComeco && !passosNoTopo && <PrimeirosPassos ctx={ctx} comeco={comecoNovo} hrefMes={d.hrefMes} />}

        {!contaNova && (
          <>
            {/* O mesmo número da pilha do Decidir (rodadas 38 e 49): tocar abre a pilha. A empresa,
                que não tem Decidir, continua vendo a lista aqui mesmo. */}
            {d.empresa ? (
              <DecisoesImportantes quantas={decisoes.length}>{decisoes.map((item) => avisoNo(item))}</DecisoesImportantes>
            ) : (
              <DecisoesImportantes quantas={foco.atencao.length} href="/decidir" />
            )}
            {/* Casal simples: o acerto do mês, debaixo das Decisões (protótipo aprovado). */}
            {casa && acerto && <CartaoAcerto acerto={acerto} casa={casa} money={redondo} href={`/mensal/foco/acerto?mes=${mesDoAcerto.ano}-${mesDoAcerto.mes}`} />}
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {/* Conta nova (nenhum lançamento ainda): o Foco é só o ComecoDoMes, na coluna da esquerda. */}
        {contaNova ? null : (
          <>
            {mesAteAgora}
            {/* Money Reset, só para quem comprou: logo abaixo do "Outubro até agora" (12/10/2026). */}
            <CartaoMoneyReset ctx={ctx} />
            <GraficoSeisMeses meses12={meses12} />
            {fecharMes && !outroMes && (
              <section className="flex flex-col gap-2.5">
                <h2 className="px-1 text-base font-semibold text-ink">{t.focoParaHoje}</h2>
                {fecharMes}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
