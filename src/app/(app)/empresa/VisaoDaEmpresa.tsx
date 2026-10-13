"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Gauge, Check, ChevronRight, FileText, ReceiptText, ShoppingBag, Tag, Truck, Megaphone, Building2, Users } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { BotaoRegistrar } from "@/components/shell/BotaoRegistrar";
import { NOME_DA_FORMA, paraO, type Forma } from "@/lib/empresa/config";
import { chaveDoMes, ehMaquininha, ehVenda, nomeDaSaida, tipoDaSaida, type LancamentoDaEmpresa, type Mes, type Recibo } from "@/lib/empresa/regras";
import { MESES, MESES_CURTOS, contasDoMes, diaCurto, diaDaSemanaDe, resumoDaEmpresa, type ResumoDaEmpresa } from "@/lib/empresa/resumo";
import { hrefDaLista, lancamentosDoPeriodo, noPeriodoTexto, resumoDoPeriodo, umMesSo, type PeriodoDaEmpresa } from "@/lib/empresa/periodo";
import type { DadosDaEmpresa } from "@/lib/empresa/dados";
import { Cartao, Iniciais, LinhaDoRecibo, LogoDaForma, Picote, BOTAO_PRINCIPAL } from "./partes";
import { RegistrarNaEmpresa } from "./RegistrarNaEmpresa";
import { CarrosselDeAbas, useArrastoEntreAbas } from "@/components/shell/Carrossel";
import { SeletorDePeriodo } from "./SeletorDePeriodo";
import { PainelDoPeriodo } from "./PainelDoPeriodo";

type Aba = "resumo" | "vendas" | "despesas" | "contas";
const ABAS: [Aba, string][] = [["resumo", "Resumo"], ["vendas", "Vendas"], ["despesas", "Despesas"], ["contas", "Contas"]];
const ord = (m: Mes) => m.ano * 12 + m.mes;

/** As cores do "Como pagou" (tons do tema, sem arco-íris). */
const COR_DA_FORMA: Record<Forma, string> = {
  credito: "var(--color-accent)",
  pix: "var(--color-success)",
  boleto: "var(--color-ink-muted)",
  debito: "var(--color-info)",
  dinheiro: "var(--color-border-strong)",
};

const ICONE_DA_SAIDA: Record<string, typeof ShoppingBag> = { ALIMENTACAO: ShoppingBag, TRANSPORTE: Truck, EDUCACAO: Megaphone, MORADIA: Building2, SAUDE: Users, IMPOSTOS: FileText };

/**
 * O dia a dia da Empresa: as abas Resumo, Vendas, Despesas e Contas com o seletor de período, o
 * recibo do mês, o "Pede sua atenção" e o + com Vendi, Paguei e Recebi. O período (13/10/2026) vem
 * do endereço: um mês mostra o recibo de sempre; mais de um mês (Este ano, Últimos 12 meses,
 * Escolher datas) mostra o painel do período. Abre no último mês fechado, como antes.
 * `antigos`: os lançamentos de um período mais velho que a janela de 12 meses (nulo: a janela basta).
 */
export function VisaoDaEmpresa({ dados, clientes, abaInicial, periodo, antigos, custom, abrirRegistrar }: { dados: DadosDaEmpresa; clientes: string[]; abaInicial: Aba; periodo: PeriodoDaEmpresa; antigos: LancamentoDaEmpresa[] | null; custom: Record<string, { nome: string; icone: string }>; abrirRegistrar: boolean }) {
  const money = useMoney();
  const m0 = (v: number) => money(v, { round: true });
  const R = useMemo(() => resumoDaEmpresa(dados), [dados]);
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [registrar, setRegistrar] = useState(abrirRegistrar);

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
          <AbaResumo dados={dados} R={R} mes={mes} periodo={periodo} recibo={recibo} atual={atual} m0={m0} money={money} />
        ) : (
          <AbaResumo dados={dados} R={R} mes={null} periodo={periodo} recibo={recibo} atual={false} m0={m0} money={money}>
            <PainelDoPeriodo r={RP} periodo={periodo} hoje={dados.hoje} ehMei={dados.config?.tipo === "MEI"} custom={custom} caminho="/empresa" />
          </AbaResumo>
        ))}
      {aba === "vendas" && <AbaVendas R={R} doPeriodo={doPeriodo} periodo={periodo} quando={quando} recibo={recibo} m0={m0} />}
      {aba === "despesas" && <AbaDespesas doPeriodo={doPeriodo} periodo={periodo} quando={quando} recibo={recibo} m0={m0} />}
      {aba === "contas" && <AbaContas dados={dados} money={money} m0={m0} />}
      </div>

      <BotaoRegistrar onClick={() => setRegistrar(true)} />
      <RegistrarNaEmpresa aberto={registrar} onFechar={() => setRegistrar(false)} dados={dados} R={R} clientes={clientes} />
    </>
  );
}

type Fmt = (v: number) => string;

function Recibo({ dados, mes, periodo, recibo, atual, salario, pago, m0 }: { dados: DadosDaEmpresa; mes: Mes; periodo: PeriodoDaEmpresa; recibo: Recibo; atual: boolean; salario: number; pago: number | null; m0: Fmt }) {
  const ehMei = dados.config?.tipo === "MEI";
  const fica = recibo.sobrou - (pago ?? salario);
  return (
    <div className="relative rounded-3xl border border-border bg-surface px-4 pb-6 pt-4">
      <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
        <span>Recibo do mês</span>
        <span>{atual ? `${MESES_CURTOS[mes.mes - 1]} ${mes.ano}, até hoje` : `${MESES_CURTOS[mes.mes - 1]} ${mes.ano}`}</span>
      </div>
      {/* Cada linha abre os lançamentos dela, para editar (13/10/2026). */}
      <Link href={hrefDaLista(periodo, "entradas")} className="block" data-linha-recibo="entradas"><LinhaDoRecibo rotulo="Entrou" valor={m0(recibo.entrou)} /></Link>
      <Link href={hrefDaLista(periodo, "variaveis")} className="block"><LinhaDoRecibo rotulo="Insumos e entregas" valor={m0(recibo.variaveis)} menos /></Link>
      <Link href={hrefDaLista(periodo, "fixas")} className="block"><LinhaDoRecibo rotulo="Contas do mês" valor={m0(recibo.fixas)} menos /></Link>
      <Link href={hrefDaLista(periodo, "impostos")} className="block"><LinhaDoRecibo rotulo={ehMei ? "Guia do MEI" : "Impostos"} valor={m0(recibo.impostos)} menos nota={atual && ehMei && recibo.impostos === 0 && dados.legal.diaDoDas ? `vence ${dados.legal.diaDoDas.valor}/${MESES_CURTOS[mes.mes - 1]}` : undefined} /></Link>
      <Link href={hrefDaLista(periodo, "lucro")} className="mt-3 block">
        <HeroiDoTema>
          <p className="text-sm text-heroi-suave">Sobrou {paraO(dados.negocio)}</p>
          <ValorDestaque texto={recibo.sobrou < 0 ? `−${m0(-recibo.sobrou)}` : m0(recibo.sobrou)} />
        </HeroiDoTema>
      </Link>
      {!atual && recibo.sobrou > 0 && (pago !== null || salario > 0) && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link href={`/empresa/salario?mes=${chaveDoMes(mes)}`} className="rounded-2xl bg-success-soft px-3 py-3 text-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-success)_25%,transparent)]">
            <small className="block text-xs text-ink-muted">Seu salário{pago !== null ? ", pago" : ""}</small>
            <ValorDestaque texto={m0(pago ?? salario)} className="text-xl font-medium tabular-nums text-ink" />
          </Link>
          <div className="rounded-2xl bg-surface-2 px-3 py-3">
            <small className="block text-xs text-ink-muted">Fica no caixa</small>
            <ValorDestaque texto={fica < 0 ? `−${m0(-fica)}` : m0(fica)} className="text-xl font-medium tabular-nums text-ink" />
          </div>
        </div>
      )}
      {atual && <p className="mt-3 text-center text-sm text-ink-muted">O salário sai quando o mês fecha.</p>}
      <Picote />
    </div>
  );
}

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

function AbaResumo({ dados, R, mes, periodo, recibo, atual, m0, money, children }: { dados: DadosDaEmpresa; R: ResumoDaEmpresa; mes: Mes | null; periodo: PeriodoDaEmpresa; recibo: Recibo; atual: boolean; m0: Fmt; money: (v: number) => string; children?: React.ReactNode }) {
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
          <small className="text-xs text-ink-muted">{R.guia.diasAte < 0 ? `venceu dia ${Number(R.guia.vence.slice(8))}` : `vence ${diaDaSemanaDe(R.guia.vence)}`}</small>
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
          <b className="block truncate text-[15px] font-medium text-ink">{d.cliente.split(" ")[0]} deve</b>
          <small className="block truncate text-xs text-ink-muted">
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
  return (
    <>
      {mes ? <Recibo dados={dados} mes={mes} periodo={periodo} recibo={recibo} atual={atual} salario={salario} pago={pago} m0={m0} /> : children}
      {mes && !atual && pago === null && salario > 0 && (
        <Link href={`/empresa/salario?mes=${chaveDoMes(mes)}`} className={BOTAO_PRINCIPAL}>
          Ver meu holerite
        </Link>
      )}
      <h2 className="mt-2 flex items-center justify-between gap-2 px-1 text-lg font-medium text-ink">
        Pede sua atenção <span className="flex min-w-6 items-center justify-center rounded-full bg-ink px-2 text-sm tabular-nums text-canvas">{itens.length}</span>
      </h2>
      {/* Protótipo: um cartão por coisa, com a faixa colorida na esquerda e o ícone tingido. */}
      <div className="flex flex-col gap-2" data-pede-atencao>
        {itens.length ? itens : <Cartao className="px-4"><p className="py-4 text-sm text-ink-muted">Nada por agora.</p></Cartao>}
      </div>
      <Link href="/empresa/como-vai" className="mx-auto inline-flex min-h-11 items-center gap-1 px-3 text-sm font-medium text-accent-strong">
        Como vai a empresa <ChevronRight size={16} aria-hidden />
      </Link>
    </>
  );
}

function AbaVendas({ R, doPeriodo, periodo, quando, recibo, m0 }: { R: ResumoDaEmpresa; doPeriodo: LancamentoDaEmpresa[]; periodo: PeriodoDaEmpresa; quando: string; recibo: Recibo; m0: Fmt }) {
  const vendas = doPeriodo.filter((l) => ehVenda(l));
  const comForma = Object.values(recibo.porForma).reduce((s, v) => s + (v ?? 0), 0);
  const formas = (Object.keys(recibo.porForma) as Forma[]).sort((a, b) => (recibo.porForma[b] ?? 0) - (recibo.porForma[a] ?? 0));
  const aReceber = R.semanas.reduce((s, w) => s + w.total, 0);
  return (
    <>
      <HeroiDoTema>
        <p className="text-sm text-heroi-suave">Vendeu {quando}</p>
        <ValorDestaque texto={m0(recibo.entrou)} />
        <div className="grid grid-cols-2 gap-2">
          <div className="heroi-veu rounded-2xl px-3 py-2.5">
            <small className="block text-xs text-heroi-suave">Vendas</small>
            <b className="text-lg font-medium tabular-nums">{recibo.nVendas}</b>
          </div>
          <div className="heroi-veu rounded-2xl px-3 py-2.5">
            <small className="block text-xs text-heroi-suave">Por venda</small>
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
      {vendas.length > 0 && (
        <>
          <h2 className="mt-2 px-1 text-lg font-medium text-ink">Quem pagou</h2>
          <Cartao className="divide-y divide-border px-4">
            {vendas.slice(0, 4).map((v) => (
              <div key={v.id} className="flex min-h-16 items-center gap-3 py-2">
                {v.cliente ? <Iniciais nome={v.cliente} /> : <LogoDaForma forma={v.forma ?? null} size={40} />}
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-medium text-ink">{v.cliente || v.description || "Venda"}</b>
                  <small className="text-xs text-ink-muted">{[v.forma ? NOME_DA_FORMA[v.forma] : null, v.entryDate ? diaCurto(v.entryDate).replace(" ", "/") : null].filter(Boolean).join(", ")}</small>
                </span>
                <b className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{m0(v.amount)}</b>
              </div>
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
        Ver e editar as vendas <ChevronRight size={16} aria-hidden />
      </Link>
    </>
  );
}

function AbaDespesas({ doPeriodo, periodo, quando, recibo, m0 }: { doPeriodo: LancamentoDaEmpresa[]; periodo: PeriodoDaEmpresa; quando: string; recibo: Recibo; m0: Fmt }) {
  const grupos = new Map<string, { nome: string; valor: number; sobe: boolean; parent: string | null }>();
  for (const l of doPeriodo) {
    // Só o que sobe com a venda (protótipo): as contas de todo mês moram na aba Contas, e a maquininha tem o cartão dela.
    if (tipoDaSaida(l) !== "variavel" || ehMaquininha(l)) continue;
    const t = "variavel";
    const nome = nomeDaSaida(l);
    const g = grupos.get(nome) ?? { nome, valor: 0, sobe: t === "variavel", parent: l.parentCategory };
    g.valor += l.amount;
    grupos.set(nome, g);
  }
  const lista = [...grupos.values()].filter((g) => g.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 8);
  const maior = Math.max(1, ...lista.map((g) => g.valor));
  const saiu = recibo.variaveis + recibo.fixas + recibo.impostos;
  return (
    <>
      <HeroiDoTema>
        <p className="text-sm text-heroi-suave">Saiu {quando}</p>
        <ValorDestaque texto={m0(saiu)} />
        <div className="grid grid-cols-2 gap-2">
          <div className="heroi-veu rounded-2xl px-3 py-2.5">
            <small className="block text-xs text-heroi-suave">Sobe com a venda</small>
            <b className="text-lg font-medium tabular-nums">{m0(recibo.variaveis)}</b>
          </div>
          <div className="heroi-veu rounded-2xl px-3 py-2.5">
            <small className="block text-xs text-heroi-suave">Todo mês</small>
            <b className="text-lg font-medium tabular-nums">{m0(recibo.fixas + recibo.impostos)}</b>
          </div>
        </div>
      </HeroiDoTema>
      {recibo.maquininha > 0 && (
        <Cartao className="flex min-h-16 items-center gap-3 px-4 py-3">
          <LogoDoLancamento descricao={null} icon={ReceiptText} size={40} />
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-medium text-ink">Maquininha</b>
            <small className="text-xs text-ink-muted">{recibo.entrou > 0 ? `${((recibo.maquininha / recibo.entrou) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do que entrou` : "taxas do mês"}</small>
          </span>
          <b className="shrink-0 text-[15px] font-medium tabular-nums text-danger">{m0(recibo.maquininha)}</b>
        </Cartao>
      )}
      {lista.length > 0 && (
        <>
          <h2 className="mt-2 px-1 text-lg font-medium text-ink">Para onde foi</h2>
          <Cartao className="divide-y divide-border px-4">
            {lista.map((g) => {
              const Icone = (g.parent && ICONE_DA_SAIDA[g.parent]) || Tag;
              return (
                <Link key={g.nome} href={hrefDaLista(periodo, `saida:${g.nome}`)} className="flex min-h-16 items-center gap-3 py-2.5">
                  <LogoDoLancamento descricao={null} icon={Icone} size={40} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px] font-medium text-ink">{g.nome}</b>
                    <small className="text-xs text-ink-muted">{g.sobe ? "sobe com a venda" : "todo mês"}</small>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <i className="block h-full rounded-full bg-accent" style={{ width: `${Math.round((g.valor / maior) * 100)}%` }} />
                    </span>
                  </span>
                  <b className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{m0(g.valor)}</b>
                  <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
                </Link>
              );
            })}
          </Cartao>
        </>
      )}
      <Link href={hrefDaLista(periodo, "despesas")} className="mx-auto inline-flex min-h-11 items-center gap-1 px-3 text-sm text-ink-muted">
        Ver e editar as despesas <ChevronRight size={16} aria-hidden />
      </Link>
    </>
  );
}

function AbaContas({ dados, money, m0 }: { dados: DadosDaEmpresa; money: (v: number) => string; m0: Fmt }) {
  const contas = contasDoMes(dados);
  const total = contas.reduce((s, c) => s + (c.valor ?? 0), 0);
  const pago = contas.filter((c) => c.paga).reduce((s, c) => s + (c.valor ?? 0), 0);
  const nPagas = contas.filter((c) => c.paga).length;
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.parse(`${dados.hoje}T12:00:00Z`) + i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    return { iso, dia: d.getUTCDate(), sem: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getUTCDay()], tem: contas.some((c) => !c.paga && c.dia === iso) };
  });
  if (contas.length === 0) {
    return (
      <Cartao className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <p className="text-[15px] font-medium text-ink">Sem contas neste mês</p>
        <p className="text-sm text-ink-muted">Cadastre as contas fixas da empresa nas Recorrentes.</p>
        <Link href="/orcamento/contas" className="min-h-11 px-3 pt-2 text-sm font-medium text-accent-strong">
          Adicionar conta
        </Link>
      </Cartao>
    );
  }
  return (
    <>
      <HeroiDoTema>
        <p className="text-sm text-heroi-suave">Contas d{dados.negocio.com.startsWith("o ") ? "o" : "a"} {dados.negocio.sem} em {MESES[dados.mesAtual.mes - 1]}</p>
        <ValorDestaque texto={m0(total)} />
        <span className="block h-2 overflow-hidden rounded-full heroi-veu">
          <i className="block h-full rounded-full bg-[var(--color-heroi-tinta)]" style={{ width: `${total > 0 ? Math.round((pago / total) * 100) : 0}%` }} />
        </span>
        <div className="flex justify-between text-sm">
          <span>
            {nPagas} de {contas.length} {nPagas === 1 ? "paga" : "pagas"}
          </span>
          <span className="text-heroi-suave">falta {m0(total - pago)}</span>
        </div>
      </HeroiDoTema>
      <Cartao className="grid grid-cols-7 gap-1 p-2">
        {dias.map((d, i) => (
          <span key={d.iso} className={`flex flex-col items-center rounded-2xl py-2 ${i === 0 ? "bg-pill text-on-pill" : "text-ink"}`}>
            <small className={`text-xs ${i === 0 ? "opacity-80" : "text-ink-muted"}`}>{d.sem}</small>
            <b className="text-[16px] font-medium tabular-nums">{d.dia}</b>
            <i className={`mt-0.5 size-1.5 rounded-full ${d.tem ? "bg-accent" : "bg-transparent"}`} aria-hidden />
          </span>
        ))}
      </Cartao>
      <Cartao className="divide-y divide-border px-4">
        {contas.map((c) => {
          const diasAte = c.dia ? Math.round((Date.parse(c.dia) - Date.parse(dados.hoje)) / 86_400_000) : null;
          return (
            <div key={c.id} className="flex min-h-16 items-center gap-3 py-2">
              {c.paga ? (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden>
                  <Check size={18} strokeWidth={2} />
                </span>
              ) : (
                <LogoDoLancamento descricao={c.nome} icon={c.nome === "Guia do MEI" ? FileText : ReceiptText} size={40} />
              )}
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-medium text-ink">{c.nome}</b>
                <small className="text-xs text-ink-muted">
                  {c.paga ? `paga em ${Number(c.pagaEm!.slice(8))}/${MESES_CURTOS[Number(c.pagaEm!.slice(5, 7)) - 1]}` : diasAte !== null && diasAte < 0 ? `venceu dia ${Number(c.dia!.slice(8))}` : `dia ${Number(c.dia!.slice(8))}`}
                  {!c.paga && diasAte !== null && diasAte >= 0 && diasAte <= 15 && (
                    <em className="ml-2 rounded-md bg-[var(--color-atencao-fundo)] px-1.5 py-0.5 text-xs font-medium uppercase not-italic text-[var(--color-atencao)]">{diasAte === 0 ? "hoje" : `em ${diasAte} ${diasAte === 1 ? "dia" : "dias"}`}</em>
                  )}
                </small>
              </span>
              <b className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{c.valor !== null ? money(c.valor) : "varia"}</b>
            </div>
          );
        })}
      </Cartao>
      <Link href="/orcamento/contas" className="mx-auto inline-flex min-h-11 items-center gap-1 px-3 text-sm text-ink-muted">
        Editar contas <ChevronRight size={16} aria-hidden />
      </Link>
    </>
  );
}
