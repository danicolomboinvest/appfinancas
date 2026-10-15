"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChartLine, Check, TriangleAlert, Users } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { Explica } from "@/components/ui/Explica";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { cadaCemReais, mesAntes, type Mes, type PedacoDos100 } from "@/lib/empresa/regras";
import { hrefDaLista, hrefDoPeriodo, lancamentosDoPeriodo, primeiroDia, resumoDoPeriodo, ultimoDia, type PeriodoDaEmpresa } from "@/lib/empresa/periodo";
import { MESES, MESES_CURTOS } from "@/lib/empresa/resumo";
import type { DadosDaEmpresa } from "@/lib/empresa/dados";
import { Cartao, Iniciais } from "../partes";
import { categoriasDasDespesas } from "../categorias-das-despesas";

export type Janela = "3m" | "6m" | "12m" | "ano";

const ord = (m: Mes) => m.ano * 12 + m.mes;

const COR_DO_PEDACO: Record<PedacoDos100["chave"], string> = {
  ins: "var(--color-accent)",
  con: "var(--color-info)",
  maq: "var(--color-danger)",
  imp: "var(--color-ink-muted)",
  sal: "var(--color-success)",
  fic: "var(--color-border-strong)",
};

/** Os meses de cada janela: 3, 6 e 12 meses FECHADOS (o mês de hoje ainda não acabou); o ano vai até hoje. */
export function mesesDaJanela(j: Janela, atual: Mes): Mes[] {
  if (j === "ano") return Array.from({ length: atual.mes }, (_, i) => ({ ano: atual.ano, mes: i + 1 }));
  const n = j === "3m" ? 3 : j === "6m" ? 6 : 12;
  return Array.from({ length: n }, (_, i) => mesAntes(atual, n - i));
}

const periodoDosMeses = (ms: Mes[], hoje: string, ateHoje: boolean): PeriodoDaEmpresa => ({ tipo: "datas", de: primeiroDia(ms[0]), ate: ateHoje ? hoje : ultimoDia(ms[ms.length - 1]) });

/**
 * O "Como vai" acumulado (15/10/2026, a Dani: "consigo ver 3, 6 e 12 meses, mas embaixo só o
 * mensal"). Escolhida a janela, a tela inteira soma a janela: quanto entrou, saiu, o lucro, o
 * salário dela, o melhor mês, cada R$ 100, as maiores despesas por categoria e quem compra.
 */
export function Acumulado({ dados, janela, custom }: { dados: DadosDaEmpresa; janela: Janela; custom: Record<string, { nome: string; icone: string }> }) {
  const money = useMoney();
  const m0 = (v: number) => money(v, { round: true });
  const { categorias } = useProfileTheme();
  const meses = mesesDaJanela(janela, dados.mesAtual);
  const ateHoje = janela === "ano";
  const periodo = periodoDosMeses(meses, dados.hoje, ateHoje);
  const r = useMemo(() => resumoDoPeriodo(dados.lancamentos, periodo, dados.hoje), [dados, periodo.de, periodo.ate]); // eslint-disable-line react-hooks/exhaustive-deps
  // A janela de antes, do mesmo tamanho, só se os 12 meses carregados alcançam (3 e 6 meses).
  const antes = janela === "3m" || janela === "6m" ? mesesDaJanela(janela, mesAntes(dados.mesAtual, meses.length)) : null;
  const rAntes = useMemo(() => (antes ? resumoDoPeriodo(dados.lancamentos, periodoDosMeses(antes, dados.hoje, false), dados.hoje) : null), [dados, janela]); // eslint-disable-line react-hooks/exhaustive-deps
  const cats = useMemo(() => categoriasDasDespesas(lancamentosDoPeriodo(dados.lancamentos, periodo), categorias, custom), [dados, periodo.de, periodo.ate, categorias, custom]); // eslint-disable-line react-hooks/exhaustive-deps

  const comDado = r.meses.filter((z) => z.entrou > 0 || z.saiu > 0);
  if (comDado.length === 0) return <Cartao className="px-6 py-8 text-center text-sm text-ink-muted">Nenhum lançamento nesses meses.</Cartao>;

  const nome = (m: Mes) => MESES[m.mes - 1];
  const titulo = ateHoje ? `Entrou em ${dados.mesAtual.ano}, até hoje` : `Entrou de ${nome(meses[0])} a ${nome(meses[meses.length - 1])}`;
  const media = r.recibo.entrou / Math.max(1, comDado.length);
  // Só compara com a janela de antes quando ela tem lançamento em todos os meses (senão o "51% a mais" é falso).
  const antesCompleta = !!rAntes && rAntes.meses.every((z) => z.entrou > 0);
  const dif = rAntes && antesCompleta && rAntes.recibo.entrou > 0 ? Math.round(((r.recibo.entrou - rAntes.recibo.entrou) / rAntes.recibo.entrou) * 100) : null;
  const fechados = r.meses.filter((z) => !z.parcial && z.entrou > 0);
  const melhor = fechados.length > 1 ? fechados.reduce((a, b) => (b.entrou > a.entrou ? b : a)) : null;
  const margem = r.recibo.entrou > 0 ? Math.round((r.recibo.sobrou / r.recibo.entrou) * 100) : null;
  const cem = cadaCemReais(r.recibo, r.proLabore);
  const origens = [
    ...r.clientes.slice(0, 4).map((c) => ({ nome: c.nome, valor: c.valor, semNome: false })),
    ...(r.semNome.valor > 0 ? [{ nome: "Balcão e sem nome", valor: r.semNome.valor, semNome: true }] : []),
  ].sort((a, b) => b.valor - a.valor);
  const dependente = r.clientes.find((c) => r.recibo.entrou > 0 && c.valor / r.recibo.entrou > 0.3);
  const max = Math.max(1, ...r.meses.map((z) => z.entrou)) * 1.1;
  const pts = r.meses.map((z, i) => [((i + 0.5) / r.meses.length) * 100, 100 - (Math.max(0, z.sobrou) / max) * 100]);
  const totalCats = cats.reduce((s, c) => s + c.valor, 0);
  const pensar = [
    melhor && `${nome(melhor.m).charAt(0).toUpperCase()}${nome(melhor.m).slice(1)} foi o melhor mês: ${m0(melhor.entrou)}.`,
    r.clientes[0] && r.recibo.entrou > 0 && `${r.clientes[0].nome} é ${Math.round((r.clientes[0].valor / r.recibo.entrou) * 100)}% das entradas.`,
    r.recibo.maquininha > 0 && `A maquininha levou ${m0(r.recibo.maquininha)} no período.`,
  ].filter(Boolean) as string[];
  const kpi = "flex min-w-0 flex-col gap-0.5 rounded-3xl border border-border bg-surface p-3.5";

  return (
    <>
      <HeroiDoTema>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-heroi-suave">{titulo}</p>
          <Explica noHeroi rotulo="Como ler o gráfico?">
            {`As colunas são o quanto entrou em cada mês. A linha é o lucro, antes do seu salário.${ateHoje ? " O mês de hoje está listrado porque ainda não acabou." : ""} Toque numa coluna para abrir o mês.`}
          </Explica>
        </div>
        <Link href={hrefDaLista(periodo, "entradas", "/empresa/como-vai")} className="flex flex-col gap-0.5" data-acumulado-entrou>
          <ValorDestaque texto={m0(r.recibo.entrou)} />
          <small className="text-xs text-heroi-suave">
            média de {m0(media)} por mês
            {dif !== null ? `, ${dif === 0 ? "igual aos" : `${Math.abs(dif)}% a ${dif > 0 ? "mais" : "menos"} que os`} ${meses.length} meses antes` : ""}
          </small>
        </Link>
        <div className="relative mt-2 h-36">
          <div className="absolute inset-0 flex items-end gap-1.5">
            {r.meses.map((z) => (
              <Link
                key={`${z.m.ano}-${z.m.mes}`}
                href={hrefDoPeriodo("/empresa", `de=${primeiroDia(z.m)}&ate=${ultimoDia(z.m)}`)}
                aria-label={`${nome(z.m)}${z.parcial ? " até hoje" : ""}: entrou ${m0(z.entrou)}`}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <i
                  className="block w-full rounded-t-lg"
                  style={{
                    height: `${Math.max(2, (z.entrou / max) * 100)}%`,
                    background: z.parcial
                      ? "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 55%, transparent) 0 5px, color-mix(in srgb, var(--color-accent) 20%, transparent) 5px 10px)"
                      : melhor && ord(z.m) === ord(melhor.m)
                        ? "var(--color-accent)"
                        : "color-mix(in srgb, var(--color-accent) 45%, transparent)",
                  }}
                />
              </Link>
            ))}
          </div>
          {r.meses.length > 1 && (
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--color-success)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </svg>
          )}
        </div>
        <div className="flex gap-1.5">
          {r.meses.map((z) => (
            <small key={`${z.m.ano}-${z.m.mes}`} className="min-w-0 flex-1 text-center text-xs text-heroi-suave">
              {r.meses.length > 6 ? MESES_CURTOS[z.m.mes - 1][0].toUpperCase() : MESES_CURTOS[z.m.mes - 1]}
            </small>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-heroi-suave">
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-accent" />entrou</span>
          <span className="flex items-center gap-1.5"><i className="h-0.5 w-3 bg-success" />lucro</span>
        </div>
      </HeroiDoTema>

      <div className="grid grid-cols-2 gap-2.5" data-acumulado-kpis>
        <Link href={hrefDaLista(periodo, "despesas", "/empresa/como-vai")} className={kpi}>
          <span className="text-sm text-ink-muted">Saiu</span>
          <ValorDestaque texto={m0(r.despesas)} className="text-[1.5rem] font-light tabular-nums text-ink" />
          {r.recibo.entrou > 0 && <small className="text-xs text-ink-muted">{Math.round((r.despesas / r.recibo.entrou) * 100)}% do que entrou</small>}
        </Link>
        <Link href={hrefDaLista(periodo, "lucro", "/empresa/como-vai")} className={kpi}>
          <span className="text-sm text-ink-muted">{r.recibo.sobrou < 0 ? "Prejuízo" : "Lucro"}</span>
          <ValorDestaque texto={m0(Math.abs(r.recibo.sobrou))} className="text-[1.5rem] font-light tabular-nums text-ink" />
          {margem !== null && r.recibo.sobrou >= 0 && <small className="text-xs text-ink-muted">margem de {margem}%</small>}
        </Link>
        {r.proLabore > 0 ? (
          <Link href={hrefDaLista(periodo, "prolabore", "/empresa/como-vai")} className={kpi}>
            <span className="text-sm text-ink-muted">Seu salário</span>
            <ValorDestaque texto={m0(r.proLabore)} className="text-[1.5rem] font-light tabular-nums text-ink" />
            <small className="text-xs text-ink-muted">ficou na empresa {r.ficou < 0 ? "nada" : m0(r.ficou)}</small>
          </Link>
        ) : (
          <Link href={hrefDaLista(periodo, "entradas", "/empresa/como-vai")} className={kpi}>
            <span className="text-sm text-ink-muted">Entradas</span>
            <b className="text-[1.5rem] font-light tabular-nums text-ink">{r.recibo.nVendas}</b>
            {r.recibo.nVendas > 0 && <small className="text-xs tabular-nums text-ink-muted">média de {m0(r.recibo.entrou / r.recibo.nVendas)}</small>}
          </Link>
        )}
        {melhor ? (
          <div className={kpi}>
            <span className="text-sm text-ink-muted">Melhor mês</span>
            <b className="text-[1.5rem] font-light text-ink">{nome(melhor.m)}</b>
            <small className="text-xs tabular-nums text-ink-muted">entrou {m0(melhor.entrou)}</small>
          </div>
        ) : (
          <div className={kpi}>
            <span className="text-sm text-ink-muted">Margem</span>
            <b className="text-[1.5rem] font-light tabular-nums text-ink">{margem !== null ? `${margem}%` : "-"}</b>
          </div>
        )}
      </div>

      {cem && (
        <Cartao className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2 text-sm text-ink-muted">
            <span>Para onde vai cada {m0(100)} que entra</span>
            <Explica>{`De cada ${m0(100)} que entraram no período, para onde foi cada pedaço. O último é o que ficou depois de pagar tudo, inclusive você.`}</Explica>
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

      {cats.length > 0 && (
        <Cartao className="flex flex-col p-4" data-acumulado-despesas>
          <p className="mb-1 text-sm text-ink-muted">Maiores despesas</p>
          {cats.slice(0, 6).map((c) => (
            <Link key={c.chave} href={hrefDaLista(periodo, `cat:${c.chave}`, "/empresa/como-vai")} className="flex min-h-14 items-center gap-3 py-1.5">
              <LogoDoLancamento descricao={null} icon={c.Icone} size={40} />
              <span className="min-w-0 flex-1">
                <b className="block break-words text-[15px] font-medium leading-snug text-ink">{c.nome}</b>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${c.cor} 14%, transparent)` }}>
                  <i className="block h-full rounded-full" style={{ width: `${Math.max(2, (c.valor / cats[0].valor) * 100)}%`, background: c.cor }} />
                </span>
              </span>
              <span className="shrink-0 text-right">
                <b className="block text-[15px] font-medium tabular-nums text-ink">{m0(c.valor)}</b>
                <small className="text-xs tabular-nums text-ink-muted">{Math.round((c.valor / totalCats) * 100)}%</small>
              </span>
            </Link>
          ))}
        </Cartao>
      )}

      {origens.length > 0 && (
        <Cartao className="flex flex-col gap-1 p-4">
          <div className="mb-1 flex items-start justify-between gap-2 text-sm text-ink-muted">
            <span>Quem compra</span>
            <Explica>Quanto cada cliente pagou no período. Se um cliente passa de 30% das entradas, a empresa fica dependente dele.</Explica>
          </div>
          {origens.map((c) => (
            <div key={c.nome} className="flex min-h-14 items-center gap-3">
              {c.semNome ? <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted"><Users size={16} aria-hidden /></span> : <Iniciais nome={c.nome} />}
              <span className="min-w-0 flex-1">
                <b className="block break-words text-[15px] font-medium text-ink">{c.nome}</b>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <i className="block h-full rounded-full bg-accent" style={{ width: `${(c.valor / origens[0].valor) * 100}%` }} />
                </span>
              </span>
              <span className="shrink-0 text-right">
                <b className="block text-[15px] font-medium tabular-nums text-ink">{Math.round((c.valor / r.recibo.entrou) * 100)}%</b>
                <small className="text-xs tabular-nums text-ink-muted">{m0(c.valor)}</small>
              </span>
            </div>
          ))}
          <p className={`mt-1 flex items-center gap-1.5 text-sm ${dependente ? "text-[var(--color-atencao)]" : "text-success"}`}>
            {dependente ? <TriangleAlert size={14} aria-hidden /> : <Check size={14} aria-hidden />}
            {dependente ? `${dependente.nome} passa de 30% das entradas: atenção à dependência.` : "Nenhum cliente passa de 30% das entradas."}
          </p>
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
    </>
  );
}
