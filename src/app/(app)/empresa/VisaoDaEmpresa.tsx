"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Gauge, ChevronRight, FileText, Users } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { categoriasDasDespesas } from "./categorias-das-despesas";
import { ContasAPagar } from "@/app/(app)/orcamento/contas/ContasAPagar";
import { FolhaDasContas } from "@/app/(app)/orcamento/contas/folha-contexto";
import { SemanaDasContas } from "@/app/(app)/orcamento/contas/SemanaDasContas";
import type { ContaSerial } from "@/app/(app)/orcamento/contas/LinhaDaConta";
import { ORIGEM_CONTA, origensDoPaguei } from "@/lib/contas/paguei";

import type { ContaDaSemana } from "@/lib/contas/semana-das-contas";
import { useMoney } from "@/components/money/MoneyProvider";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { BotaoRegistrar } from "@/components/shell/BotaoRegistrar";
import { EVENTO_REGISTRAR_EMPRESA } from "@/components/shell/registrar-eventos";
import { NOME_DA_FORMA, type Forma } from "@/lib/empresa/config";
import { chaveDoMes, mesAntes, reciboDoMes, type LancamentoDaEmpresa, type Mes, type Recibo } from "@/lib/empresa/regras";
import { MESES, contasDoMes, diaDaSemanaDe, guiaDoMeiDaEmpresa, resumoDaEmpresa, type ResumoDaEmpresa } from "@/lib/empresa/resumo";
import { hrefDaLista, lancamentosDoPeriodo, noPeriodoTexto, resumoDoPeriodo, umMesSo, type PeriodoDaEmpresa, type ResumoDoPeriodo } from "@/lib/empresa/periodo";
import type { DadosDaEmpresa } from "@/lib/empresa/dados";
import { Cartao, Iniciais, BOTAO_PRINCIPAL } from "./partes";
import { RegistrarNaEmpresa } from "./RegistrarNaEmpresa";
import { CarrosselDeAbas, useArrastoEntreAbas } from "@/components/shell/Carrossel";
import { SeletorDePeriodo } from "./SeletorDePeriodo";
import { PainelDoPeriodo } from "./PainelDoPeriodo";

type Aba = "resumo" | "entradas" | "despesas" | "contas";
const ABAS: [Aba, string][] = [["resumo", "Resumo"], ["entradas", "Entradas"], ["despesas", "Despesas"], ["contas", "Contas"]];
const ord = (m: Mes) => m.ano * 12 + m.mes;

/** As cores do "Como pagou" (tons do tema, sem arco-íris). */
const COR_DA_FORMA: Record<Forma, string> = {
  credito: "var(--color-accent)",
  pix: "var(--color-success)",
  boleto: "var(--color-ink-muted)",
  debito: "var(--color-info)",
  dinheiro: "var(--color-border-strong)",
};


/**
 * O dia a dia da Empresa: as abas Resumo, Vendas, Despesas e Contas com o seletor de período, o
 * recibo do mês, o "Pede sua atenção" e o + com Vendi, Paguei e Recebi. O período (13/10/2026) vem
 * do endereço: um mês mostra o recibo de sempre; mais de um mês (Este ano, Últimos 12 meses,
 * Escolher datas) mostra o painel do período. Abre no último mês fechado, como antes.
 * `antigos`: os lançamentos de um período mais velho que a janela de 12 meses (nulo: a janela basta).
 */
export function VisaoDaEmpresa({ dados, clientes, abaInicial, periodo, antigos, custom, abrirRegistrar, contas }: { dados: DadosDaEmpresa; clientes: string[]; abaInicial: Aba; periodo: PeriodoDaEmpresa; antigos: LancamentoDaEmpresa[] | null; custom: Record<string, { nome: string; icone: string }>; abrirRegistrar: boolean; contas: ContasDaTela }) {
  const money = useMoney();
  const m0 = (v: number) => money(v, { round: true });
  const R = useMemo(() => resumoDaEmpresa(dados), [dados]);
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [registrar, setRegistrar] = useState(abrirRegistrar);
  // O "Registrar" da barra lateral do computador, com a pessoa já nesta tela.
  useEffect(() => {
    const abrir = () => setRegistrar(true);
    window.addEventListener(EVENTO_REGISTRAR_EMPRESA, abrir);
    return () => window.removeEventListener(EVENTO_REGISTRAR_EMPRESA, abrir);
  }, []);

  const lancs = antigos ?? dados.lancamentos;
  const RP = useMemo(() => resumoDoPeriodo(lancs, periodo, dados.hoje), [lancs, periodo, dados.hoje]);
  const doPeriodo = useMemo(() => lancamentosDoPeriodo(lancs, periodo), [lancs, periodo]);
  const mes = umMesSo(periodo, dados.hoje);
  const atual = !!mes && ord(mes) === ord(dados.mesAtual);
  const recibo = RP.recibo;
  const quando = noPeriodoTexto(periodo, dados.hoje);
  const iAba = ABAS.findIndex(([k]) => k === aba);
  // Arrastar o conteúdo para o lado troca de aba, como nas outras faixas do app.
  const conteudo = useArrastoEntreAbas<HTMLDivElement>({ indice: iAba, total: ABAS.length, chave: aba, onLado: (p) => trocarAba(ABAS[iAba + p][0]) });
  const trocarAba = (a: Aba) => {
    setAba(a);
    try {
      // O período fica no endereço ao trocar de aba.
      const q = new URLSearchParams(window.location.search);
      if (a === "resumo") q.delete("aba");
      else q.set("aba", a);
      q.delete("registrar");
      const texto = q.toString();
      window.history.replaceState(null, "", texto ? `/empresa?${texto}` : "/empresa");
    } catch {}
  };

  return (
    <>
      {/* As abas em carrossel, como na Visão geral: a aberta no centro, arrastar gira. */}
      <CarrosselDeAbas rotulo={dados.nome} ativa={aba} itens={ABAS.map(([k, t]) => ({ chave: k, rotulo: t }))} onEscolher={(k) => trocarAba(k as Aba)} />

      {aba !== "contas" && <SeletorDePeriodo periodo={periodo} hoje={dados.hoje} caminho="/empresa" manter={aba === "resumo" ? {} : { aba }} />}

      <div ref={conteudo} className="flex flex-col gap-4">
      {aba === "resumo" &&
        (mes ? (
          <AbaResumo dados={dados} R={R} mes={mes} periodo={periodo} recibo={recibo} atual={atual} lancs={lancs} m0={m0} money={money} />
        ) : (
          <AbaResumo dados={dados} R={R} mes={null} periodo={periodo} recibo={recibo} atual={false} lancs={lancs} m0={m0} money={money}>
            <PainelDoPeriodo r={RP} periodo={periodo} hoje={dados.hoje} ehMei={dados.config?.tipo === "MEI"} custom={custom} caminho="/empresa" />
          </AbaResumo>
        ))}
      {aba === "entradas" && <AbaEntradas R={R} RP={RP} periodo={periodo} quando={quando} recibo={recibo} m0={m0} />}
      {aba === "despesas" && <AbaDespesas doPeriodo={doPeriodo} periodo={periodo} quando={quando} recibo={recibo} custom={custom} m0={m0} />}
      {aba === "contas" && <AbaContas dados={dados} contas={contas} m0={m0} />}
      </div>

      <BotaoRegistrar onClick={() => setRegistrar(true)} />
      <RegistrarNaEmpresa aberto={registrar} onFechar={() => setRegistrar(false)} dados={dados} R={R} clientes={clientes} />
    </>
  );
}

type Fmt = (v: number) => string;

function Faixa({ cor }: { cor: string }) {
  return <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />;
}

function IconeTingido({ icon: Icone, cor }: { icon: typeof FileText; cor: string }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${cor} 14%, var(--color-surface))`, color: cor }} aria-hidden>
      <Icone size={18} strokeWidth={1.7} />
    </span>
  );
}

/** Um quadradinho do herói que abre a lista daquele total. */
function Quadradinho({ href, rotulo, valor }: { href: string; rotulo: string; valor: string }) {
  return (
    <Link href={href} className="heroi-veu min-w-0 rounded-2xl px-3 py-2.5">
      <small className="block text-xs text-heroi-suave">{rotulo}</small>
      <ValorDestaque texto={valor} className="text-[17px] font-medium tabular-nums" />
    </Link>
  );
}

/** "2% a menos que agosto", "igual a agosto". Ganho e perda em palavra. */
function contraOMesAntes(a: number, b: number, nomeAntes: string): string | null {
  if (b <= 0) return null;
  const d = Math.round(((a - b) / b) * 100);
  if (d === 0) return `igual a ${nomeAntes}`;
  return `${Math.abs(d)}% a ${d > 0 ? "mais" : "menos"} que ${nomeAntes}`;
}

function AbaResumo({ dados, R, mes, periodo, recibo, atual, lancs, m0, money, children }: { dados: DadosDaEmpresa; R: ResumoDaEmpresa; mes: Mes | null; periodo: PeriodoDaEmpresa; recibo: Recibo; atual: boolean; lancs: LancamentoDaEmpresa[]; m0: Fmt; money: (v: number) => string; children?: React.ReactNode }) {
  const pagoDoMes = mes ? dados.lancamentos.find((l) => l.externalId === `prolabore:${chaveDoMes(mes)}`) : undefined;
  const pago = pagoDoMes ? pagoDoMes.amount : null;
  const salario = Math.min(R.salario, Math.max(0, recibo.sobrou));
  const itens: React.ReactNode[] = [];
  if (R.guia && !R.guia.paga) {
    itens.push(
      <Link key="guia" href="/empresa?aba=contas" className="relative flex min-h-16 items-center gap-3 overflow-hidden rounded-2xl bg-surface py-2 pl-4 pr-3 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <Faixa cor="var(--color-accent)" />
        <IconeTingido icon={FileText} cor="var(--color-accent-strong)" />
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-medium text-ink">Guia do MEI</b>
          <small className="text-xs text-ink-muted">
            {R.guia.diasAte < 0 ? `venceu dia ${Number(R.guia.vence.slice(8))}` : `vence ${diaDaSemanaDe(R.guia.vence)}`}
            {R.guia.origem === "estimada" ? ", estimado pelo app" : ""}
          </small>
        </span>
        <b className="shrink-0 text-[15px] font-medium tabular-nums text-accent-strong">{money(R.guia.valor)}</b>
      </Link>,
    );
  }
  for (const d of R.devendo.slice(0, 3)) {
    itens.push(
      <Link key={d.id} href="/empresa/recebimentos" className="relative flex min-h-16 items-center gap-3 overflow-hidden rounded-2xl bg-surface py-2 pl-4 pr-3 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <Faixa cor="var(--color-danger)" />
        <Iniciais nome={d.cliente} />
        <span className="min-w-0 flex-1">
          <b className="block break-words text-[15px] font-medium text-ink">{d.cliente.split(" ")[0]} deve</b>
          <small className="block break-words text-xs text-ink-muted">
            {d.descricao ? `${d.descricao.charAt(0).toLowerCase()}${d.descricao.slice(1)}, ` : ""}há {d.dias} {d.dias === 1 ? "dia" : "dias"}
          </small>
        </span>
        <b className="shrink-0 text-[15px] font-medium tabular-nums text-danger">{m0(d.valor)}</b>
      </Link>,
    );
  }
  if (R.limite?.alerta) {
    const p = Math.min(100, R.limite.pct * 100);
    itens.push(
      <Link key="limite" href="/empresa/limite" className="relative flex min-h-16 items-center gap-3 overflow-hidden rounded-2xl bg-surface py-2 pl-4 pr-3 shadow-[inset_0_0_0_1px_var(--color-border)]" data-pct={p}>
        <Faixa cor="var(--color-danger)" />
        <IconeTingido icon={Gauge} cor="var(--color-danger)" />
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-medium text-ink">Limite do MEI</b>
          <small className="text-xs text-ink-muted">{R.limite.faixa !== "mei" ? "passou do teto" : R.limite.passaEm ? `pela média de ${R.limite.ritmoMeses} ${R.limite.ritmoMeses === 1 ? "mês" : "meses"}, chega em ${MESES[R.limite.passaEm - 1]}` : "perto do teto"}</small>
        </span>
        <b className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{Math.round(R.limite.pct * 100)}%</b>
      </Link>,
    );
  }

  // O mês (11/10 → 15/10/2026, a Dani): o primeiro número é quanto ENTROU, não o que sobrou.
  const saiu = recibo.variaveis + recibo.fixas + recibo.impostos;
  const antes = mes ? reciboDoMes(lancs, mesAntes(mes, 1)) : null;
  const comparacao = mes && antes && !atual ? contraOMesAntes(recibo.entrou, antes.entrou, MESES[mesAntes(mes, 1).mes - 1]) : null;
  const seuSalario = pago ?? (atual ? 0 : salario);
  const ficou = recibo.sobrou - seuSalario;
  // Para onde foi o que entrou: despesas, o salário dela e o que ficou no caixa (só com lucro).
  const pedacos = recibo.entrou > 0 && recibo.sobrou >= 0
    ? [
        { nome: "Despesas", valor: saiu, cor: "var(--color-accent)" },
        ...(seuSalario > 0 ? [{ nome: "Seu salário", valor: seuSalario, cor: "var(--color-success)" }] : []),
        { nome: seuSalario > 0 ? "Ficou no caixa" : atual ? "Sobrou até hoje" : "Lucro", valor: Math.max(0, ficou), cor: "var(--color-info)" },
      ].filter((p) => p.valor > 0)
    : [];

  return (
    <>
      {mes ? (
        <HeroiDoTema>
          <p className="text-sm text-heroi-suave">Entrou {atual ? `em ${MESES[mes.mes - 1]}, até hoje` : `em ${MESES[mes.mes - 1]}`}</p>
          <Link href={hrefDaLista(periodo, "entradas")} className="flex flex-col gap-0.5" data-linha-recibo="entradas">
            <ValorDestaque texto={m0(recibo.entrou)} />
            <small className="text-xs text-heroi-suave">
              {[recibo.nVendas > 0 ? `${recibo.nVendas} ${recibo.nVendas === 1 ? "entrada" : "entradas"}` : null, comparacao].filter(Boolean).join(", ")}
            </small>
          </Link>
          <div className="grid grid-cols-3 gap-2">
            <Quadradinho href={hrefDaLista(periodo, "despesas")} rotulo="Saiu" valor={m0(saiu)} />
            <Quadradinho href={hrefDaLista(periodo, "lucro")} rotulo={recibo.sobrou < 0 ? "Prejuízo" : "Lucro"} valor={m0(Math.abs(recibo.sobrou))} />
            {atual ? (
              <Quadradinho href={hrefDaLista(periodo, "impostos")} rotulo={dados.config?.tipo === "MEI" ? "Guia" : "Impostos"} valor={m0(recibo.impostos)} />
            ) : (
              <Quadradinho href={`/empresa/salario?mes=${chaveDoMes(mes)}`} rotulo={pago !== null ? "Salário pago" : "Seu salário"} valor={m0(seuSalario)} />
            )}
          </div>
        </HeroiDoTema>
      ) : (
        children
      )}
      {mes && pedacos.length > 1 && (
        <Cartao className="flex flex-col gap-3 p-4" data-para-onde-foi>
          <p className="text-sm text-ink-muted">Para onde foi o que entrou</p>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={pedacos.map((p) => `${p.nome} ${Math.round((p.valor / recibo.entrou) * 100)}%`).join(", ")}>
            {pedacos.map((p) => (
              <i key={p.nome} style={{ flexGrow: p.valor, background: p.cor }} />
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            {pedacos.map((p) => (
              <span key={p.nome} className="flex items-center gap-2 text-sm text-ink">
                <i className="size-2.5 shrink-0 rounded-full" style={{ background: p.cor }} />
                {p.nome}
                <b className="ml-auto font-medium tabular-nums">{Math.round((p.valor / recibo.entrou) * 100)}%</b>
              </span>
            ))}
          </div>
        </Cartao>
      )}
      {mes && !atual && pago === null && salario > 0 && (
        <Link href={`/empresa/salario?mes=${chaveDoMes(mes)}`} className={BOTAO_PRINCIPAL}>
          Ver meu holerite
        </Link>
      )}
      {atual && mes && <p className="text-center text-sm text-ink-muted">O salário sai quando o mês fecha.</p>}
      <h2 className="mt-2 flex items-center justify-between gap-2 px-1 text-lg font-medium text-ink">
        Pede sua atenção <span className="flex min-w-6 items-center justify-center rounded-full bg-ink px-2 text-sm tabular-nums text-canvas">{itens.length}</span>
      </h2>
      <div className="flex flex-col gap-2" data-pede-atencao>
        {itens.length ? itens : <Cartao className="px-4"><p className="py-4 text-sm text-ink-muted">Nada por agora.</p></Cartao>}
      </div>
      <Link href="/empresa/como-vai" className="mx-auto inline-flex min-h-11 items-center gap-1 px-3 text-sm font-medium text-accent-strong">
        Como vai a empresa <ChevronRight size={16} aria-hidden />
      </Link>
    </>
  );
}

/** Entradas (15/10/2026, a Dani: "entradas ao invés de vendas"), agrupadas por quem pagou. */
function AbaEntradas({ R, RP, periodo, quando, recibo, m0 }: { R: ResumoDaEmpresa; RP: ResumoDoPeriodo; periodo: PeriodoDaEmpresa; quando: string; recibo: Recibo; m0: Fmt }) {
  const comForma = Object.values(recibo.porForma).reduce((s, v) => s + (v ?? 0), 0);
  const formas = (Object.keys(recibo.porForma) as Forma[]).sort((a, b) => (recibo.porForma[b] ?? 0) - (recibo.porForma[a] ?? 0));
  const aReceber = R.semanas.reduce((s, w) => s + w.total, 0);
  const origens = [
    ...RP.clientes.slice(0, 5).map((c) => ({ chave: `cliente:${c.nome}`, nome: c.nome, valor: c.valor, n: c.n, semNome: false })),
    ...(RP.semNome.valor > 0 ? [{ chave: "cliente:", nome: "Balcão e sem nome", valor: RP.semNome.valor, n: RP.semNome.n, semNome: true }] : []),
  ].sort((a, b) => b.valor - a.valor);
  const maior = Math.max(1, ...origens.map((o) => o.valor));
  return (
    <>
      <HeroiDoTema>
        <p className="text-sm text-heroi-suave">Entrou {quando}</p>
        <ValorDestaque texto={m0(recibo.entrou)} />
        <div className="grid grid-cols-2 gap-2">
          <div className="heroi-veu rounded-2xl px-3 py-2.5">
            <small className="block text-xs text-heroi-suave">Entradas</small>
            <b className="text-lg font-medium tabular-nums">{recibo.nVendas}</b>
          </div>
          <div className="heroi-veu rounded-2xl px-3 py-2.5">
            <small className="block text-xs text-heroi-suave">Média por entrada</small>
            <b className="text-lg font-medium tabular-nums">{recibo.nVendas ? m0(recibo.entrou / recibo.nVendas) : "-"}</b>
          </div>
        </div>
      </HeroiDoTema>
      {comForma > 0 && (
        <Cartao className="p-4">
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={formas.map((f) => `${NOME_DA_FORMA[f]} ${Math.round(((recibo.porForma[f] ?? 0) / comForma) * 100)}%`).join(", ")}>
            {formas.map((f) => (
              <i key={f} style={{ flexGrow: recibo.porForma[f], background: COR_DA_FORMA[f] }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {formas.map((f) => (
              <span key={f} className="flex items-center gap-2 text-sm text-ink">
                <i className="size-2.5 shrink-0 rounded-full" style={{ background: COR_DA_FORMA[f] }} />
                {NOME_DA_FORMA[f]}
                <b className="ml-auto font-medium tabular-nums">{Math.round(((recibo.porForma[f] ?? 0) / comForma) * 100)}%</b>
              </span>
            ))}
          </div>
        </Cartao>
      )}
      {origens.length > 0 && (
        <>
          <h2 className="mt-2 px-1 text-lg font-medium text-ink">De onde veio</h2>
          <Cartao className="divide-y divide-border px-4" data-de-onde-veio>
            {origens.map((o) => (
              <Link key={o.chave} href={hrefDaLista(periodo, o.chave as `cliente:${string}`)} className="flex min-h-16 items-center gap-3 py-2.5">
                {o.semNome ? <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted shadow-[inset_0_0_0_1px_var(--color-border)]"><Users size={16} aria-hidden /></span> : <Iniciais nome={o.nome} />}
                <span className="min-w-0 flex-1">
                  <b className="block break-words text-[15px] font-medium text-ink">{o.nome}</b>
                  <small className="text-xs text-ink-muted">{o.n} {o.n === 1 ? "entrada" : "entradas"}</small>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <i className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Math.round((o.valor / maior) * 100))}%` }} />
                  </span>
                </span>
                <b className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{m0(o.valor)}</b>
                <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
              </Link>
            ))}
          </Cartao>
        </>
      )}
      {aReceber > 0 && (
        <Link href="/empresa/recebimentos" className="flex min-h-16 items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3">
          <LogoDoLancamento descricao={null} icon={CalendarDays} size={40} />
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-medium text-ink">A receber</b>
            <small className="text-xs text-ink-muted">nas próximas 4 semanas</small>
          </span>
          <b className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{m0(aReceber)}</b>
        </Link>
      )}
      <Link href={hrefDaLista(periodo, "entradas")} className="mx-auto inline-flex min-h-11 items-center gap-1 px-3 text-sm text-ink-muted">
        Ver e editar as entradas <ChevronRight size={16} aria-hidden />
      </Link>
    </>
  );
}

/** O anel das despesas: as 5 maiores categorias e "Outras", com o total no meio. */
function AnelDasDespesas({ fatias, total, m0 }: { fatias: { nome: string; valor: number; cor: string }[]; total: number; m0: Fmt }) {
  // Onde cada fatia começa: a soma das anteriores.
  const inicios = fatias.map((_, i) => fatias.slice(0, i).reduce((s, f) => s + (f.valor / total) * 100, 0));
  return (
    <svg viewBox="0 0 42 42" className="size-32 shrink-0" role="img" aria-label={fatias.map((f) => `${f.nome} ${Math.round((f.valor / total) * 100)}%`).join(", ")}>
      <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--color-surface-2)" strokeWidth="6" />
      {fatias.map((f, i) => {
        const pct = (f.valor / total) * 100;
        // Um respiro de 0,6 entre as fatias, sem sumir com a fatia pequena.
        const folga = fatias.length > 1 ? 0.6 : 0;
        return <circle key={f.nome} cx="21" cy="21" r="15.9" fill="none" stroke={f.cor} strokeWidth="6" pathLength={100} strokeDasharray={`${Math.max(0.4, pct - folga)} ${100 - pct + folga}`} strokeDashoffset={25 - inicios[i]} />;
      })}
      <text x="21" y="19.5" textAnchor="middle" fontSize="3.4" fill="var(--color-ink-muted)">saiu</text>
      <text x="21" y="25" textAnchor="middle" fontSize="5" fill="var(--color-ink)">{m0(total).replace(/^R\$\s*/, "")}</text>
    </svg>
  );
}

type FiltroDespesa = "todas" | "variaveis" | "fixas";

function AbaDespesas({ doPeriodo, periodo, quando, recibo, custom, m0 }: { doPeriodo: LancamentoDaEmpresa[]; periodo: PeriodoDaEmpresa; quando: string; recibo: Recibo; custom: Record<string, { nome: string; icone: string }>; m0: Fmt }) {
  const { categorias } = useProfileTheme();
  const [filtro, setFiltro] = useState<FiltroDespesa>("todas");
  const todas = useMemo(() => categoriasDasDespesas(doPeriodo, categorias, custom), [doPeriodo, categorias, custom]);
  const total = todas.reduce((s, c) => s + c.valor, 0);
  const lista = filtro === "todas" ? todas : todas.filter((c) => (filtro === "variaveis" ? c.tipo === "variavel" : c.tipo === "fixa"));
  const fatias = todas.length > 6 ? [...todas.slice(0, 5), { nome: "Outras", valor: todas.slice(5).reduce((s, c) => s + c.valor, 0), cor: "var(--color-border-strong)" }] : todas;
  if (todas.length === 0) {
    return (
      <Cartao className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <p className="text-[15px] font-medium text-ink">Nenhuma despesa {quando}</p>
        <Link href={hrefDaLista(periodo, "despesas")} className="min-h-11 px-3 pt-2 text-sm font-medium text-accent-strong">Ver lançamentos</Link>
      </Cartao>
    );
  }
  return (
    <>
      <Cartao className="flex items-center gap-4 p-4" data-anel-despesas>
        <AnelDasDespesas fatias={fatias} total={total} m0={m0} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {fatias.map((f) => (
            <span key={f.nome} className="flex items-center gap-2 text-sm text-ink">
              <i className="size-2.5 shrink-0 rounded-full" style={{ background: f.cor }} />
              <span className="min-w-0 break-words leading-snug">{f.nome}</span>
              <b className="ml-auto pl-1 font-medium tabular-nums">{Math.round((f.valor / total) * 100)}%</b>
            </span>
          ))}
        </div>
      </Cartao>
      {recibo.entrou > 0 && <p className="-mt-1 px-1 text-sm text-ink-muted">Saiu {quando}: {Math.round((total / recibo.entrou) * 100)}% do que entrou.</p>}
      <div className="flex gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="Quais despesas">
        {([["todas", "Todas"], ["variaveis", "Variáveis"], ["fixas", "Fixas"]] as const).map(([k, t]) => (
          <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)} className={`min-h-10 flex-1 rounded-full text-sm ${filtro === k ? "bg-surface font-medium text-ink shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-ink-muted"}`}>
            {t}
          </button>
        ))}
      </div>
      <Cartao className="divide-y divide-border px-4" data-categorias-despesas>
        {lista.length === 0 && <p className="py-4 text-sm text-ink-muted">Nada aqui {quando}.</p>}
        {lista.map((c) => (
          <Link key={c.chave} href={hrefDaLista(periodo, `cat:${c.chave}`)} className="flex min-h-16 items-center gap-3 py-2.5">
            <IconeTingido icon={c.Icone} cor={c.cor} />
            <span className="min-w-0 flex-1">
              <b className="block break-words text-[15px] font-medium leading-snug text-ink">{c.nome}</b>
              <small className="block break-words text-xs text-ink-muted">{c.dentro.length ? `${c.dentro.slice(0, 3).join(", ")}${c.dentro.length > 3 ? ` e mais ${c.dentro.length - 3}` : ""}` : `${c.n} ${c.n === 1 ? "lançamento" : "lançamentos"}`}</small>
            </span>
            <span className="shrink-0 text-right">
              <b className="block text-[15px] font-medium tabular-nums text-ink">{m0(c.valor)}</b>
              <small className="text-xs tabular-nums text-ink-muted">{Math.round((c.valor / total) * 100)}%</small>
            </span>
            <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
          </Link>
        ))}
      </Cartao>
      <Link href={hrefDaLista(periodo, "despesas")} className="mx-auto inline-flex min-h-11 items-center gap-1 px-3 text-sm text-ink-muted">
        Ver e editar as despesas <ChevronRight size={16} aria-hidden />
      </Link>
    </>
  );
}

/** As contas da Empresa (15/10/2026): o quanto falta pagar e, embaixo, a semana e as contas das Recorrentes. */
export type ContasDaTela = { abertas: ContaSerial[]; pagas: ContaSerial[]; vencimentos: ContaDaSemana[]; hoje: string };

/** Sem o palpite carregado: as origens genéricas (Pix ou débito, Cartão, Dinheiro). */
const PAGUEI_SEM_DADOS = { origens: origensDoPaguei([]), origem: ORIGEM_CONTA, antes: {} };

function AbaContas({ dados, contas, m0 }: { dados: DadosDaEmpresa; contas: ContasDaTela; m0: Fmt }) {
  const doMes = contasDoMes(dados);
  const total = doMes.reduce((s, c) => s + (c.valor ?? 0), 0);
  const pago = doMes.filter((c) => c.paga).reduce((s, c) => s + (c.valor ?? 0), 0);
  const nPagas = doMes.filter((c) => c.paga).length;
  // A guia do MEI ainda no valor da tabela: o selo "estimado pelo app" na conta dela.
  const selos: Record<string, string> = guiaDoMeiDaEmpresa(dados)?.origem === "estimada" ? Object.fromEntries(contas.abertas.filter((c) => c.nome === "Guia do MEI").map((c) => [c.id, "estimado pelo app"])) : {};
  return (
    <FolhaDasContas hoje={contas.hoje} abrirNova={false}>
      {doMes.length > 0 && (
        <HeroiDoTema>
          <p className="text-sm text-heroi-suave">{total - pago > 0 ? `Falta pagar em ${MESES[dados.mesAtual.mes - 1]}` : `Contas de ${MESES[dados.mesAtual.mes - 1]}`}</p>
          <ValorDestaque texto={m0(total - pago > 0 ? total - pago : total)} />
          <span className="block h-2 overflow-hidden rounded-full heroi-veu">
            <i className="block h-full rounded-full bg-[var(--color-heroi-tinta)]" style={{ width: `${total > 0 ? Math.round((pago / total) * 100) : 0}%` }} />
          </span>
          <p className="text-sm text-heroi-suave">
            {nPagas === doMes.length ? "Todas pagas" : `${nPagas} de ${doMes.length} ${nPagas === 1 ? "paga" : "pagas"}, de ${m0(total)}`}
          </p>
        </HeroiDoTema>
      )}
      <SemanaDasContas contas={contas.vencimentos} hoje={contas.hoje} />
      {/* O mesmo "Paguei" das Recorrentes (versão B): a linha abre o palpite e o Pronto cria o gasto. */}
      <ContasAPagar contas={contas.abertas} pagas={contas.pagas} hoje={contas.hoje} selos={selos} paguei={dados.paguei ?? PAGUEI_SEM_DADOS} />
    </FolhaDasContas>
  );
}
