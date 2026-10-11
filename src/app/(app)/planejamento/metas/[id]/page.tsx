import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, PiggyBank } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { serverMoney } from "@/lib/money-server";
import { ativosDaMeta, aportesSemMeta, lerMetaDaTela, type MetaDaTela } from "@/lib/repositories/metas.repo";
import { MESES_CURTOS, MESES_LONGOS, chaveDoMes, duracao, mesDaqui, mesDoAporte, mesesAteOMes, mesesDaMeta, situacaoDoMes } from "@/lib/metas/projecao";
import { proximoAporte } from "@/lib/planning/goal-checkin";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { Explica } from "@/components/ui/Explica";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { ProvedorDaFolhaDaMeta, type MetaParaEditar } from "../FolhaDaMeta";
import { textoDoSelo } from "../visual";
import { GraficoQuandoChego } from "./GraficoQuandoChego";
import { CartaoDoAporte, type EstadoDoAporte } from "./CartaoDoAporte";
import { MesAMes, type MesDaMeta } from "./MesAMes";
import { BarraDaMeta, VoltarAoRitmo } from "./AcoesDaMeta";
import "../metas.css";

const dd = (n: number) => String(n).padStart(2, "0");
const isoDia = (d: Date) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
const origemDoTexto = (t: string | null) => (/pix|transf|ted/i.test(t ?? "") ? "Pix para você" : /dinheiro/i.test(t ?? "") ? "Dinheiro" : "Aplicação");

/** O cartão do aporte do mês: feito, achado no extrato, adiado ou perguntado. */
async function estadoDoAporte(ctx: Awaited<ReturnType<typeof getRequiredSession>>, meta: MetaDaTela, hoje: Date): Promise<EstadoDoAporte | null> {
  if (meta.plano.status === "ACHIEVED") return null;
  const ref = mesDoAporte(hoje);
  const chaves = new Set([ref.chave]);
  if (ref.doMesPassado) chaves.add(chaveDoMes(hoje.getFullYear(), hoje.getMonth() + 1));
  const doMes = meta.aportes.filter((a) => chaves.has(chaveDoMes(a.ano, a.mes)) && a.valor > 0);
  if (doMes.length > 0) {
    const ultimo = doMes[doMes.length - 1];
    let proximo: { mes: string; valor: number } | null = null;
    const seguinte = mesDaqui(hoje, 1);
    if (meta.prazo) {
      const p = proximoAporte({ targetAmount: meta.alvo, currentAmount: meta.guardado, targetDate: meta.prazo, annualRate: meta.taxaAnual, now: hoje });
      if (p) proximo = { mes: MESES_CURTOS[Number(p.monthKey.slice(5)) - 1], valor: Math.ceil(p.amount) };
    } else if (meta.combinado > 0) proximo = { mes: MESES_CURTOS[seguinte.mes - 1], valor: meta.combinado };
    return { tipo: "feito", mes: ref.nome, valor: doMes.reduce((t, a) => t + a.valor, 0), origem: origemDoTexto(ultimo.descricao), data: ultimo.dia ? `${dd(ultimo.dia)}/${dd(ultimo.mes)}` : null, proximo };
  }
  const achado = (await aportesSemMeta(ctx, meta.id, meta.aportesRecusados, hoje))[0];
  if (achado) return { tipo: "pendente", entradaId: achado.id, valor: achado.valor, origem: achado.origem, quando: achado.dia ? `${achado.dia} de ${MESES_LONGOS[achado.mes - 1]}` : null };
  if (meta.aporteAdiadoMes === ref.chave) return { tipo: "adiado", mesDeHoje: MESES_LONGOS[hoje.getMonth()] };
  return { tipo: "perguntar", mes: ref.nome, combinado: meta.plano.porMesNecessario || meta.combinado, diaMin: isoDia(new Date(ref.ano, ref.mes - 1, 1)), diaMax: isoDia(hoje) };
}

/**
 * O detalhe da meta (protótipo, rodada 32, proposta B "painel com projeção"): a foto de ponta a
 * ponta, o valor, a régua esperado × você, o status, o aporte do mês, quando chego (gráfico com
 * real, plano e ritmo), voltar ao ritmo (só atrasada), mês a mês, onde está o dinheiro e a barra
 * com Adicionar, retirar e editar.
 */
export default async function DetalheDaMetaPage(props: PageProps<"/planejamento/metas/[id]">) {
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  const meta = await lerMetaDaTela(ctx, id, hoje);
  if (!meta) notFound();
  const [money, ativos, aporte] = await Promise.all([serverMoney(), ativosDaMeta(ctx, meta.id), estadoDoAporte(ctx, meta, hoje)]);
  const m = (v: number) => money(v, { round: true });
  const { plano } = meta;
  const ruim = plano.status === "BEHIND";
  const bom = plano.status === "ON_TRACK" && !plano.nova;
  const esperadoPct = plano.esperado !== null && !plano.nova && plano.status !== "ACHIEVED" ? Math.min(100, (plano.esperado / meta.alvo) * 100) : null;
  const prazoN = meta.prazo ? mesesAteOMes(hoje, meta.prazo) : null;
  const chegaRitmo = plano.chegaPeloRitmo ? plano.chega : plano.status === "ACHIEVED" ? 0 : null;
  const quando =
    chegaRitmo === null ? "ainda sem ritmo para calcular" : chegaRitmo === 0 ? "chegou" : plano.tarde && prazoN !== null ? `${duracao(chegaRitmo - prazoN)} depois do prazo` : prazoN !== null ? "no prazo" : `em ${duracao(chegaRitmo)}`;
  const taxaTexto = meta.taxaAnual > 0 ? `rendendo ${Math.round(meta.taxaAnual * 1000) / 10}% ao ano` : "sem rendimento";

  const mesesDaTela: MesDaMeta[] = mesesDaMeta(meta.inicio, hoje)
    .slice(-12)
    .map((x) => {
      const total = meta.aportesPorMes.get(x.chave) ?? 0;
      const ehAtual = x.ano === hoje.getFullYear() && x.mes === hoje.getMonth() + 1;
      return {
        chave: x.chave,
        curto: MESES_CURTOS[x.mes - 1],
        nome: MESES_LONGOS[x.mes - 1],
        situacao: situacaoDoMes(total, meta.combinado, ehAtual),
        total,
        aportes: meta.aportes
          .filter((a) => a.ano === x.ano && a.mes === x.mes)
          .map((a) => ({
            id: a.id,
            amount: a.valor,
            year: a.ano,
            month: a.mes,
            description: a.descricao,
            futuro: false,
            linha: `${a.valor < 0 ? "retirou " : ""}${m(Math.abs(a.valor))} · ${origemDoTexto(a.descricao)}${a.dia ? ` em ${dd(a.dia)}/${dd(a.mes)}` : ""}`,
          })),
      };
    });

  const paraEditar: MetaParaEditar = {
    id: meta.id,
    nome: meta.nome,
    tipo: meta.icon,
    alvo: meta.alvo,
    guardado: meta.guardado,
    prazo: meta.prazo ? chaveDoMes(meta.prazo.getFullYear(), meta.prazo.getMonth() + 1) : null,
    foto: meta.foto,
    combinado: meta.combinado,
    taxaAnual: meta.taxaAnual,
  };
  const novoPrazo = ruim && plano.chegaPeloRitmo && plano.chega !== null ? mesDaqui(hoje, plano.chega).texto : null;

  return (
    <ProvedorDaFolhaDaMeta hoje={{ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, dia: hoje.getDate() }}>
      <div className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-xl flex-col gap-3.5">
        <div className="md-foto -mx-5 -mt-2 md:mx-0 md:overflow-hidden md:rounded-[28px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto da meta */}
          <img src={meta.foto} alt="" decoding="async" fetchPriority="high" />
          <Link href="/planejamento/metas" aria-label="Voltar para Metas" className="md-vidro absolute left-5 top-2.5 flex size-11 items-center justify-center rounded-full">
            <ChevronLeft size={20} aria-hidden />
          </Link>
        </div>

        <div className="relative flex flex-col gap-0.5">
          <span className="text-base font-semibold text-ink">{meta.nome}</span>
          <ValorDestaque texto={m(meta.guardado)} className="text-[40px] font-light leading-[1.08] tracking-[-0.03em] tabular-nums text-ink max-[359px]:text-[34px]" />
          <small className="text-[13.5px] font-medium text-ink-muted">
            de {m(meta.alvo)} · {meta.prazo ? `${MESES_CURTOS[meta.prazo.getMonth()]}/${meta.prazo.getFullYear()}` : "sem prazo"}
          </small>
          <div
            className={`relative h-2.5 rounded-full bg-surface-2 ${esperadoPct !== null ? "mt-10" : "mt-3.5"}`}
            role="img"
            aria-label={`${plano.pct}% guardado${esperadoPct !== null && plano.esperado !== null ? `, o esperado era ter ~${m(plano.esperado)}` : ""}`}
          >
            <i className="absolute inset-y-0 left-0 min-w-2.5 rounded-full bg-[var(--color-dinheiro-guardou)]" style={{ width: `${Math.min(plano.pct, 100)}%` }} />
            {esperadoPct !== null && plano.esperado !== null && (
              <span className="absolute -bottom-2 -top-2 -ml-px w-0.5 rounded-sm bg-ink" style={{ left: `${esperadoPct.toFixed(1)}%` }}>
                <em className="absolute bottom-[calc(100%+4px)] left-1/2 whitespace-nowrap text-[12.5px] font-medium not-italic text-ink-muted" style={{ transform: `translateX(-${esperadoPct.toFixed(1)}%)` }}>
                  esperado <b className="font-semibold text-ink">~{m(plano.esperado)}</b>
                </em>
              </span>
            )}
          </div>
          <div className="mt-1.5 flex justify-between gap-2.5 text-[13px] font-medium text-ink-muted">
            <span className="font-semibold text-ink">{plano.pct}%</span>
            <span>{meta.prazo && plano.mesesAtePrazo !== null && plano.status !== "ACHIEVED" ? `faltam ${duracao(plano.mesesAtePrazo)}` : ""}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-semibold before:size-[7px] before:rounded-full before:bg-current ${ruim ? "bg-danger-soft text-danger" : bom || plano.status === "ACHIEVED" ? "bg-success-soft text-success" : "bg-surface-2 text-ink"}`}>
            {textoDoSelo(plano.status, plano.nova)}
          </span>
          {ruim && plano.atras !== null && <span className="text-sm font-semibold text-danger">{m(plano.atras)} atrás</span>}
          {bom && <span className="text-sm font-semibold text-success">dentro da folga</span>}
          <span className="ml-auto">
            <Explica rotulo="Como sabemos">
              Comparamos o que você já guardou com o que era de esperar pelo tempo que passou. Só fica atrasada abaixo de 85% do esperado, então um mês apertado não vira atrasada. O valor por mês já conta com o rendimento do que está guardado.
            </Explica>
          </span>
        </div>

        {aporte && <CartaoDoAporte metaId={meta.id} estado={aporte} />}

        <section className="glass flex flex-col gap-2 rounded-3xl p-4">
          <div className="flex items-center justify-between gap-3">
            <b className="text-base font-semibold text-ink">Quando chego</b>
            <Explica rotulo="Como sabemos">
              A linha cheia é o que você guardou. A tracejada é o plano até o prazo. A pontilhada é o seu ritmo: a média dos últimos 3 meses, {taxaTexto}, até a bandeira. O valor por mês para voltar ao ritmo já conta o rendimento.
            </Explica>
          </div>
          {plano.nova ? (
            <span className="text-sm font-semibold text-ink-muted">o primeiro aporte começa a contar</span>
          ) : (
            <>
              <span className={`-mt-1 text-sm font-semibold ${plano.tarde || chegaRitmo === null ? "text-danger" : "text-success"}`}>{quando}</span>
              <GraficoQuandoChego meta={meta} hoje={hoje} />
              <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] font-medium text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <i className="md-leg-r w-4" aria-hidden />
                  guardado
                </span>
                {meta.prazo && (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="md-leg-p w-4" aria-hidden />
                    plano
                  </span>
                )}
                {plano.chegaPeloRitmo && plano.chega !== null && plano.chega > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <i className={`md-leg-j w-4 ${plano.tarde ? "ruim" : ""}`} aria-hidden />
                    ritmo atual
                  </span>
                )}
              </div>
            </>
          )}
        </section>

        {ruim && <VoltarAoRitmo metaId={meta.id} porMes={plano.porMesNecessario} novoPrazo={novoPrazo} />}

        {!plano.nova && mesesDaTela.length > 0 && <MesAMes meses={mesesDaTela} />}

        {ativos.length > 0 && (
          <div role="group" aria-label="Onde está o dinheiro" className="flex flex-wrap gap-2">
            {ativos.map((a) => (
              <Link
                key={a.id}
                href="/carteira"
                aria-label={`Onde está o dinheiro: ${a.nome}, ${m(a.valor)}`}
                className="inline-flex min-h-12 max-w-full items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-3 text-ink shadow-premium-sm"
              >
                <LogoDoLancamento descricao={a.descricao} icon={PiggyBank} size={36} />
                <span className="min-w-0 truncate text-[14.5px] font-semibold">{a.nome}</span>
                <ValorDestaque texto={m(a.valor)} className="whitespace-nowrap text-sm font-medium tabular-nums text-ink-muted" />
                <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
              </Link>
            ))}
          </div>
        )}

        <BarraDaMeta metaId={meta.id} meta={paraEditar} />
      </div>
    </ProvedorDaFolhaDaMeta>
  );
}
