"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChartLine, Check, Clock, TriangleAlert, Users } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { Explica } from "@/components/ui/Explica";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { cadaCemReais, despesasQueCresceram, ehVenda, mesAntes, prazoMedio, quemCompra, reciboDoMes, type Mes, type PedacoDos100 } from "@/lib/empresa/regras";
import { MESES, MESES_CURTOS, resumoDaEmpresa } from "@/lib/empresa/resumo";
import type { DadosDaEmpresa } from "@/lib/empresa/dados";
import { Cartao, Iniciais, Voltar } from "../partes";

const ord = (m: Mes) => m.ano * 12 + m.mes;
const nomeDoMes = (m: Mes, cap = false) => {
  const n = MESES[m.mes - 1];
  return cap ? n[0].toUpperCase() + n.slice(1) : n;
};

const COR_DO_PEDACO: Record<PedacoDos100["chave"], string> = {
  ins: "var(--color-accent)",
  con: "var(--color-info)",
  maq: "var(--color-danger)",
  imp: "var(--color-ink-muted)",
  sal: "var(--color-success)",
  fic: "var(--color-border-strong)",
};

/** "5% a menos que agosto", "igual". Ganho e perda em palavra, sem seta. */
function Comparacao({ a, b, contra: r, inverso = false }: { a: number; b: number | null; contra?: string; inverso?: boolean }) {
  if (b === null || b === 0 || !Number.isFinite(a / b)) return null;
  const d = ((a - b) / Math.abs(b)) * 100;
  if (Math.abs(d) < 0.5) return <span className="text-xs text-ink-muted">igual{r ? ` a ${r}` : ""}</span>;
  const bom = inverso ? d < 0 : d > 0;
  return (
    <span className={`text-xs font-medium ${bom ? "text-success" : "text-danger"}`}>
      {Math.round(Math.abs(d))}% a {d > 0 ? "mais" : "menos"}
      {r ? ` que ${r}` : ""}
    </span>
  );
}

function Linhazinha({ valores, cor }: { valores: number[]; cor: string }) {
  if (valores.length < 2) return null;
  const w = 88;
  const h = 28;
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const r = max - min || 1;
  const p = valores.map((v, i) => [3 + (i / (valores.length - 1)) * (w - 6), h - 4 - ((v - min) / r) * (h - 8)]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden className="my-1">
      <polyline points={p.map((x) => x.join(",")).join(" ")} fill="none" stroke={cor} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={p[p.length - 1][0]} cy={p[p.length - 1][1]} r={2.6} fill={cor} />
    </svg>
  );
}

/**
 * "Como vai a empresa" (rodada 36, aprovada): o gráfico herói de faturamento com a linha do lucro e o
 * seletor 3M, 6M e 12M; os indicadores com linhazinha; a corrida até o ponto de equilíbrio; cada R$ 100
 * vendido; quem compra; o que mais cresceu e "Para pensar". Só números de verdade: mês sem lançamento
 * não entra, e o que não tem dado não aparece.
 */
export function ComoVai({ dados }: { dados: DadosDaEmpresa }) {
  const money = useMoney();
  const m0 = (v: number) => money(v, { round: true });
  const R = useMemo(() => resumoDaEmpresa(dados), [dados]);
  const serie = useMemo(() => {
    const primeiro = dados.lancamentos.length ? dados.lancamentos[dados.lancamentos.length - 1] : null;
    if (!primeiro) return [];
    const ini = { ano: primeiro.year, mes: primeiro.month };
    const meses: Mes[] = [];
    for (let m = ini; ord(m) <= ord(dados.mesAtual); m = mesAntes(m, -1)) meses.push(m);
    return meses.slice(-12).map((m) => {
      const r = reciboDoMes(dados.lancamentos, m);
      return { m, fat: r.entrou, luc: r.sobrou, n: r.nVendas, parcial: ord(m) === ord(dados.mesAtual) };
    });
  }, [dados]);
  const [n, setN] = useState(6);
  const vis = serie.slice(-n);
  const [sel, setSel] = useState<number | null>(null);
  const iSel = sel !== null && sel < vis.length ? sel : Math.max(0, vis.length - (vis.length > 1 ? 2 : 1));
  const x = vis[iSel];
  const antX = x ? serie[serie.indexOf(x) - 1] : undefined;

  if (!x) {
    return (
      <>
        <Voltar>{dados.nome}</Voltar>
        <Cartao className="px-6 py-8 text-center text-sm text-ink-muted">Registre as primeiras vendas para ver como vai a empresa.</Cartao>
      </>
    );
  }

  const max = Math.max(1, ...vis.map((z) => z.fat)) * 1.1;
  const pts = vis.map((z, i) => [((i + 0.5) / vis.length) * 100, 100 - (Math.max(0, z.luc) / max) * 100]);
  const fechados = serie.filter((z) => !z.parcial);
  const u6 = fechados.slice(-6);
  const ult = fechados[fechados.length - 1];
  const penult = fechados[fechados.length - 2] ?? null;
  const tres = dados.lancamentos.filter((l) => ehVenda(l) && ord({ ano: l.year, mes: l.month }) >= ord(mesAntes(dados.mesAtual, 3)) && ord({ ano: l.year, mes: l.month }) < ord(dados.mesAtual));
  const prazo = prazoMedio(tres);
  const atrasado = R.devendo.reduce((s, d) => s + d.valor, 0);
  const cem = cadaCemReais(R.reciboFechado, R.salario);
  const qc = quemCompra(tres);
  const cresceram = despesasQueCresceram(dados.lancamentos, R.ultimoFechado, mesAntes(R.ultimoFechado, 1));
  const doAno = fechados.filter((z) => z.m.ano === dados.mesAtual.ano && z.fat > 0);
  const melhor = doAno.length > 1 ? doAno.reduce((a, b) => (b.fat > a.fat ? b : a)) : null;
  const maisVendas = doAno.length > 1 ? doAno.reduce((a, b) => (b.n > a.n ? b : a)) : null;
  const pensar = [
    melhor && `${nomeDoMes(melhor.m, true)} foi o melhor mês do ano: ${m0(melhor.fat)}.`,
    maisVendas && maisVendas.n > 1 && `${nomeDoMes(maisVendas.m, true)} teve ${maisVendas.n} vendas, o maior número do ano.`,
    qc && qc.clientes[0] && `${qc.clientes[0].nome} é ${qc.clientes[0].pct}% das vendas dos últimos 3 meses.`,
    R.reciboFechado.maquininha > 0 && `A maquininha levou ${m0(R.reciboFechado.maquininha)} em ${nomeDoMes(R.ultimoFechado)}.`,
  ].filter(Boolean) as string[];

  const ideal = R.pe ? (R.pe * dados.dia) / dados.diasNoMes : 0;
  const frente = R.reciboAtual.entrou >= ideal;
  const semanas = R.caixaDias !== null ? Array.from({ length: 8 }, (_, i) => Math.max(0, Math.min(1, (R.caixaDias! - i * 7) / 7))) : [];
  const kpi = "flex min-w-0 flex-col rounded-3xl border border-border bg-surface p-3.5";
  const kt = "flex items-start justify-between gap-1 text-sm text-ink-muted";

  return (
    <>
      <Voltar>{dados.nome}</Voltar>

      <HeroiDoTema>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-heroi-suave">Faturamento e lucro</p>
          <Explica noHeroi rotulo="Como ler o gráfico?">
            As colunas são o quanto vendeu em cada mês. A linha é o lucro, antes do seu salário. O mês de hoje está listrado porque ainda não acabou. Toque numa coluna para ver o mês.
          </Explica>
        </div>
        <div className="heroi-veu flex w-fit gap-1 rounded-full p-1" role="group" aria-label="Período">
          {[3, 6, 12].map((k) => (
            <button key={k} type="button" aria-pressed={n === k} onClick={() => { setN(k); setSel(null); }} className={`min-h-9 rounded-full px-4 text-sm ${n === k ? "bg-surface font-medium text-ink" : ""}`}>
              {k}M
            </button>
          ))}
        </div>
        <div aria-live="polite">
          <b className="text-[17px] font-medium">
            {nomeDoMes(x.m, true)}
            {x.parcial ? " até hoje" : ""}
          </b>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <span>
              <small className="block text-xs text-heroi-suave">faturou</small>
              <ValorDestaque texto={m0(x.fat)} className="text-[1.35rem] font-light tabular-nums" />
            </span>
            <span>
              <small className="block text-xs text-heroi-suave">lucro</small>
              <ValorDestaque texto={x.luc < 0 ? `−${m0(-x.luc)}` : m0(x.luc)} className="text-[1.35rem] font-light tabular-nums" />
            </span>
            <span>
              <small className="block text-xs text-heroi-suave">margem</small>
              <b className="text-[1.35rem] font-light tabular-nums">{x.fat > 0 ? `${Math.round((x.luc / x.fat) * 100)}%` : "-"}</b>
            </span>
          </div>
          {antX && !x.parcial && <div className="mt-1"><Comparacao a={x.fat} b={antX.fat} contra={nomeDoMes(antX.m)} /></div>}
        </div>
        <div className="relative mt-2 h-40">
          <div className="absolute inset-0 flex items-end gap-1.5">
            {vis.map((z, i) => (
              <button
                key={`${z.m.ano}-${z.m.mes}`}
                type="button"
                aria-pressed={i === iSel}
                aria-label={`${nomeDoMes(z.m, true)}${z.parcial ? " até hoje" : ""}: faturou ${m0(z.fat)}`}
                onClick={() => setSel(i)}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <i
                  className="block w-full rounded-t-lg"
                  style={{
                    height: `${Math.max(2, (z.fat / max) * 100)}%`,
                    background: z.parcial
                      ? "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 55%, transparent) 0 5px, color-mix(in srgb, var(--color-accent) 20%, transparent) 5px 10px)"
                      : i === iSel
                        ? "var(--color-accent)"
                        : "color-mix(in srgb, var(--color-accent) 35%, transparent)",
                  }}
                />
              </button>
            ))}
          </div>
          {vis.length > 1 && (
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--color-success)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </svg>
          )}
        </div>
        <div className="flex gap-1.5">
          {vis.map((z, i) => (
            <small key={`${z.m.ano}-${z.m.mes}`} className={`min-w-0 flex-1 text-center text-xs ${i === iSel ? "font-semibold" : "text-heroi-suave"}`}>
              {n === 12 ? MESES_CURTOS[z.m.mes - 1][0].toUpperCase() : MESES_CURTOS[z.m.mes - 1]}
            </small>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-heroi-suave">
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-accent" />faturou</span>
          <span className="flex items-center gap-1.5"><i className="h-0.5 w-3 bg-success" />lucro</span>
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,var(--color-accent)_0_2px,transparent_2px_4px)]" />até hoje</span>
        </div>
      </HeroiDoTema>

      {ult && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className={kpi}>
            <span className={kt}>Lucro e margem <Explica>O que sobrou depois de insumos, contas e guia, antes do seu salário. {`A margem é o lucro de cada ${m0(100)} vendidos.`}</Explica></span>
            <ValorDestaque texto={ult.luc < 0 ? `−${m0(-ult.luc)}` : m0(ult.luc)} className="text-[1.6rem] font-light tabular-nums text-ink" />
            <Linhazinha valores={u6.map((z) => z.luc)} cor="var(--color-success)" />
            {penult && <Comparacao a={ult.luc} b={penult.luc} />}
            <small className="text-xs text-ink-muted">margem {ult.fat > 0 ? Math.round((ult.luc / ult.fat) * 100) : 0}%</small>
          </div>
          {ult.n > 0 && (
            <div className={kpi}>
              <span className={kt}>Venda média <Explica>{`O valor médio de cada venda de ${nomeDoMes(ult.m)}, e quantas vendas foram.`}</Explica></span>
              <ValorDestaque texto={m0(ult.fat / ult.n)} className="text-[1.6rem] font-light tabular-nums text-ink" />
              <Linhazinha valores={u6.filter((z) => z.n > 0).map((z) => z.fat / z.n)} cor="var(--color-info)" />
              {penult && penult.n > 0 && <Comparacao a={ult.fat / ult.n} b={penult.fat / penult.n} />}
              <small className="text-xs text-ink-muted">
                {ult.n} {ult.n === 1 ? "venda" : "vendas"}
                {penult && penult.n !== ult.n ? `, ${Math.abs(ult.n - penult.n)} a ${ult.n > penult.n ? "mais" : "menos"}` : ""}
              </small>
            </div>
          )}
          {R.caixaDias !== null && (
            <div className={kpi}>
              <span className={kt}>Caixa <Explica>{`Se parar de vender hoje, os ${m0(dados.caixa)} do caixa pagam ${R.caixaDias} dias de contas, guia e salário. Cada bloco é uma semana.`}</Explica></span>
              <b className="text-[1.6rem] font-light tabular-nums text-ink">{R.caixaDias} dias</b>
              <span className="my-2 flex gap-1" aria-hidden>
                {semanas.map((f, i) => (
                  <i key={i} className="h-3 flex-1 rounded-sm bg-surface-2" style={{ background: `linear-gradient(90deg, var(--color-success) ${f * 100}%, var(--color-surface-2) ${f * 100}%)` }} />
                ))}
              </span>
              <small className="text-xs text-ink-muted">{m0(dados.caixa)}</small>
            </div>
          )}
          {prazo !== null && (
            <div className={kpi}>
              <span className={kt}>Para receber <Explica>{`Em média, o dinheiro cai ${prazo} dias depois da venda (nas vendas em que você disse o dia). O cartão puxa para cima.`}</Explica></span>
              <b className="text-[1.6rem] font-light tabular-nums text-ink">{prazo} {prazo === 1 ? "dia" : "dias"}</b>
              <small className={`mt-auto text-xs ${atrasado > 0 ? "font-medium text-danger" : "text-ink-muted"}`}>{atrasado > 0 ? `${m0(atrasado)} atrasado` : "nada atrasado"}</small>
            </div>
          )}
        </div>
      )}

      {R.pe !== null && R.falta !== null && (
        <Cartao className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2 text-sm text-ink-muted">
            <span>Para pagar tudo em {nomeDoMes(dados.mesAtual)}</span>
            <Explica>{`A linha de chegada é ${m0(R.pe)}: com isso de vendas no mês, ${dados.negocio.com} paga insumos, contas, guia e o seu salário. O tracinho é onde estaria hoje vendendo igual todos os dias.`}</Explica>
          </div>
          <b className="text-[1.35rem] font-medium text-ink">{R.falta > 0 ? `faltam ${m0(R.falta)}` : "já pagou tudo"}</b>
          <div className="relative mt-3 h-3 rounded-full bg-surface-2">
            <i className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.min(100, (R.reciboAtual.entrou / R.pe) * 100)}%` }} />
            <i className="absolute -top-1.5 h-6 w-0.5 bg-ink" style={{ left: `${Math.min(100, (ideal / R.pe) * 100)}%` }} aria-hidden />
          </div>
          <div className="flex justify-between text-sm">
            <span><b className="font-medium tabular-nums text-ink">{m0(R.reciboAtual.entrou)}</b> <small className="text-ink-muted">vendeu</small></span>
            <span><b className="font-medium tabular-nums text-ink">{m0(R.pe)}</b> <small className="text-ink-muted">paga tudo</small></span>
          </div>
          <p className={`flex items-center gap-1.5 text-sm ${R.falta <= 0 || frente ? "text-success" : "text-[var(--color-atencao)]"}`}>
            {R.falta <= 0 || frente ? <Check size={14} aria-hidden /> : <Clock size={14} aria-hidden />}
            {R.falta <= 0 ? "O mês já está pago." : frente ? `À frente do ritmo: no dia ${dados.dia}, o normal seria ${m0(ideal)}.` : `Atrás do ritmo: no dia ${dados.dia}, o normal seria ${m0(ideal)}.`}
          </p>
        </Cartao>
      )}

      {cem && (
        <Cartao className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2 text-sm text-ink-muted">
            <span>Para onde vai cada {m0(100)} vendido</span>
            <Explica>{`De cada ${m0(100)} que entraram em ${nomeDoMes(R.ultimoFechado)}, para onde foi cada pedaço. O último é o que ficou depois de pagar tudo, inclusive você.`}</Explica>
          </div>
          <div className="flex h-4 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={cem.map((p) => `${p.nome} ${m0(p.cem)}`).join(", ")}>
            {cem.map((p) => (
              <i key={p.chave} style={{ flexGrow: Math.max(p.cem, 0.5), background: COR_DO_PEDACO[p.chave] }} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 min-[360px]:grid-cols-2">
            {cem.map((p) => (
              <span key={p.chave} className="flex items-center gap-2 text-sm text-ink">
                <i className="size-2.5 shrink-0 rounded-full" style={{ background: COR_DO_PEDACO[p.chave] }} />
                <span className="min-w-0 break-words">{p.nome}</span>
                <b className="ml-auto whitespace-nowrap font-medium tabular-nums">{m0(p.cem)}</b>
              </span>
            ))}
          </div>
        </Cartao>
      )}

      {qc && (
        <Cartao className="flex flex-col gap-1 p-4">
          <div className="mb-1 flex items-start justify-between gap-2 text-sm text-ink-muted">
            <span>Quem compra <small>3 meses</small></span>
            <Explica>Quanto cada cliente comprou nos últimos 3 meses. Se um cliente passa de 30% das vendas, a empresa fica dependente dele.</Explica>
          </div>
          {[...qc.clientes.map((c) => ({ nome: c.nome, valor: c.valor, pct: c.pct, outros: false })), { nome: "Balcão e outros", valor: qc.outros.valor, pct: qc.outros.pct, outros: true }].map((c) => (
            <div key={c.nome} className="flex min-h-14 items-center gap-3">
              {c.outros ? (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted"><Users size={16} aria-hidden /></span>
              ) : (
                <Iniciais nome={c.nome} />
              )}
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-medium text-ink">{c.nome}</b>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <i className="block h-full rounded-full bg-accent" style={{ width: `${(c.valor / Math.max(1, ...qc.clientes.map((x) => x.valor), qc.outros.valor)) * 100}%` }} />
                </span>
              </span>
              <span className="shrink-0 text-right">
                <b className="block text-[15px] font-medium tabular-nums text-ink">{c.pct}%</b>
                <small className="text-xs tabular-nums text-ink-muted">{m0(c.valor)}</small>
              </span>
            </div>
          ))}
          <p className={`mt-1 flex items-center gap-1.5 text-sm ${qc.dependente ? "text-[var(--color-atencao)]" : "text-success"}`}>
            {qc.dependente ? <TriangleAlert size={14} aria-hidden /> : <Check size={14} aria-hidden />}
            {qc.dependente ? `${qc.dependente.nome} passa de 30% das vendas: atenção à dependência.` : "Nenhum cliente passa de 30% das vendas."}
          </p>
        </Cartao>
      )}

      {cresceram.length > 0 && (
        <Cartao className="flex flex-col gap-1 p-4">
          <p className="mb-1 text-sm text-ink-muted">
            Despesas que mais cresceram <small>vs. {nomeDoMes(mesAntes(R.ultimoFechado, 1))}</small>
          </p>
          {cresceram.map((c) => (
            <div key={c.nome} className="flex min-h-12 items-center gap-3">
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-medium text-ink">{c.nome}</b>
                <small className="text-xs text-ink-muted">{m0(c.valor)} no mês</small>
              </span>
              <span className="shrink-0 text-xs font-medium text-danger">{m0(c.mais)} a mais</span>
            </div>
          ))}
        </Cartao>
      )}

      {pensar.length > 0 && (
        <Cartao className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2 text-sm text-ink-muted">
            <span>Para pensar</span>
            <Explica>Leituras automáticas dos seus números. São fatos, não conselhos.</Explica>
          </div>
          {pensar.map((t) => (
            <p key={t} className="flex gap-2 text-[15px] text-ink">
              <ChartLine size={16} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
              <span>{t}</span>
            </p>
          ))}
        </Cartao>
      )}

      <Link href="/empresa/relatorios" className="mx-auto inline-flex min-h-11 items-center px-3 text-sm text-ink-muted">
        Ver a DRE do mês
      </Link>
    </>
  );
}
