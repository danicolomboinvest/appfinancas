"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, CircleAlert, Clock, MinusCircle, Route } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { ErroNoBotao, TENTAR_DE_NOVO, useErroNoBotao } from "@/components/ui/ErroNoBotao";
import type { Coisinha, PlanoDaMeta } from "@/lib/planning/plano-da-meta";
import { alternativasPara, economiaPara } from "@/lib/planning/plano-da-meta-regua";
import { usarPlanoAction } from "./acoes";
import { ItemDaCoisinha } from "./ItemDaCoisinha";
import { JaGuardaCartao } from "./JaGuarda";

type Mostra = Extract<PlanoDaMeta, { mostra: true }>;
type Saida = "nenhuma" | "prazo" | "menor" | "daa";

export type MetaNaTela = { id: string; nome: string; alvo: number; guardado: number; prazo: string | null; taxaAnual: number };

const AVISO: Partial<Record<Mostra["avisos"][number], string>> = {
  sobra_negativa: "Hoje o que sai passa do que entra. Confira se a renda está toda lançada.",
  sem_renda: "Sem renda lançada: o plano não sabe quanto já sobra.",
  renda_de_um_mes: "A renda é de um mês só.",
};

const dataDoPrazo = (p: string | null) => {
  const m = /^(\d{4})-(\d{2})$/.exec(p ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1, 12) : null;
};

function Aviso({ texto }: { texto: string }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-accent-soft px-3 py-2.5 text-[13.5px] font-medium text-ink">
      <CircleAlert size={16} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
      <span>{texto}</span>
    </p>
  );
}

/**
 * A tela do "Como vou juntar?" (versão A aprovada pela Dani em 16/10/2026): a frase do que falta
 * com a barra, as coisinhas para marcar, a régua de quanto gastar em cada uma (com a quantidade
 * pelo ticket dela), as duas saídas quando não fecha e o "Usar esse plano". Toda conta vem do
 * motor (lib/planning); o servidor confere de novo ao usar.
 */
export function TelaDoPlano({ meta, plano, hoje, inicial }: { meta: MetaNaTela; plano: Mostra; hoje: { ano: number; mes: number; dia: number }; inicial?: { itens: { id: string; valor: number }[]; saida: Saida; trazer?: { id: string; valor: number }[] } | null }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: Number.isInteger(Math.round(v * 100) / 100) });
  const router = useRouter();
  const erro = useErroNoBotao();
  const [pendente, iniciar] = useTransition();
  const hojeData = useMemo(() => new Date(hoje.ano, hoje.mes - 1, hoje.dia, 12), [hoje.ano, hoje.mes, hoje.dia]);

  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries((inicial?.itens ?? []).map((i) => [i.id, true])));
  const [val, setVal] = useState<Record<string, number>>(() => Object.fromEntries((inicial?.itens ?? []).map((i) => [i.id, i.valor])));
  const [saida, setSaida] = useState<Saida | null>(inicial && inicial.saida !== "nenhuma" ? inicial.saida : null);
  // O que ela traz das outras metas para esta (régua "Trazer para esta meta").
  const [trazer, setTrazer] = useState<Record<string, number>>(() => Object.fromEntries((inicial?.trazer ?? []).map((t) => [t.id, t.valor])));
  const trazido = plano.jaGuarda.fontes.reduce((s, f) => s + Math.min(f.podeTrazer, trazer[f.id] ?? 0), 0);

  const valor = (c: Coisinha) => (c.acao === "cancelar" ? 0 : (val[c.id] ?? c.para));
  const economia = (c: Coisinha) => (c.acao === "cancelar" ? c.hoje : economiaPara(c, valor(c)));
  const achado = Math.round(plano.coisinhas.reduce((s, c) => s + (sel[c.id] ? economia(c) : 0), 0) * 100) / 100;
  // O que falta já descontado do que ela trouxe das outras metas (a frase e a barra mudam na hora).
  const falta = Math.max(0, plano.falta - trazido);
  const fechou = plano.pede !== null && achado + trazido >= plano.falta - 1e-9;
  const alts = useMemo(
    () => (fechou || plano.pede === null ? null : alternativasPara({ alvo: meta.alvo, guardado: meta.guardado, prazo: dataDoPrazo(meta.prazo), taxaAnual: meta.taxaAnual }, plano.sobra + trazido + achado, hojeData)),
    [fechou, plano.pede, plano.sobra, trazido, achado, meta.alvo, meta.guardado, meta.prazo, meta.taxaAnual, hojeData],
  );
  const saidaValida = saida !== null && !!alts && ((saida === "prazo" && !!alts.prazo) || (saida === "menor" && !!alts.metaMenor) || (saida === "daa" && !!alts.oQueDa));
  const temItem = plano.coisinhas.some((c) => sel[c.id] && economia(c) > 0);
  const podeUsar = fechou ? temItem || trazido > 0 : saidaValida;

  function usar() {
    erro.limpar();
    const itens = plano.coisinhas.filter((c) => sel[c.id]).map((c) => ({ id: c.id, valor: valor(c) }));
    iniciar(async () => {
      const trazerAgora = plano.jaGuarda.fontes.filter((f) => (trazer[f.id] ?? 0) > 0).map((f) => ({ id: f.id, valor: Math.min(f.podeTrazer, trazer[f.id] ?? 0) }));
      const r = await usarPlanoAction(meta.id, { itens, saida: fechou ? "nenhuma" : (saida ?? "nenhuma"), trazer: trazerAgora });
      if (!r.ok) return erro.falhou(r.error);
      router.push(`/planejamento/metas/${meta.id}/plano`);
      router.refresh();
    });
  }

  // A barra: o que já sobra e o que veio das outras metas (verde), mais as coisinhas (cor do tema).
  const pct = plano.pede ? Math.min(100, ((plano.sobra + trazido + achado) / plano.pede) * 100) : 0;
  const pctSobra = plano.pede ? Math.min(100, ((plano.sobra + trazido) / plano.pede) * 100) : 0;
  const status = fechou ? (achado > falta ? `Fechou! E sobram ${m(achado - falta)} no mês` : "Fechou!") : achado === 0 ? "Toque no que topa reduzir" : `Faltam ${m(falta - achado)} por mês`;
  const avisos = plano.avisos.map((a) => AVISO[a]).filter((t): t is string => !!t);

  const topo = (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center px-1 pt-1">
      <Link href="/planejamento/metas" className="flex min-h-11 items-center gap-0.5 justify-self-start pr-2 text-[15px] font-medium text-ink">
        <ChevronLeft size={18} aria-hidden /> Metas
      </Link>
      <h1 className="text-center text-[15px] font-semibold text-ink">Como vou juntar?</h1>
      <span />
    </div>
  );

  // Situações em que não há o que marcar.
  if (plano.situacao === "poucos_dados" || plano.situacao === "ja_cabe" || plano.situacao === "sem_prazo" || (plano.situacao === "sem_coisinhas" && !plano.alternativas?.prazo && !plano.alternativas?.metaMenor && !plano.alternativas?.oQueDa && plano.jaGuarda.trazivel === 0)) {
    const voltarMeta = (
      <Link href={`/planejamento/metas/${meta.id}`} className="flex min-h-[52px] w-full items-center justify-center rounded-full bg-surface-2 px-5 text-base font-semibold text-ink">
        Voltar para a meta
      </Link>
    );
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3.5" data-plano={plano.situacao}>
        {topo}
        <div className="flex flex-col gap-3 rounded-[24px] border border-border bg-surface p-4">
          {plano.situacao === "ja_cabe" && (
            <>
              <p className="text-[22px] font-medium leading-tight text-ink">Já cabe</p>
              <p className="text-[15px] text-ink-muted">O que sobra hoje já paga essa meta até {plano.prazoTexto}. Nem precisa de plano.</p>
            </>
          )}
          {plano.situacao === "sem_prazo" && (
            <>
              <p className="text-[15px] font-medium text-ink-muted">Com o que sobra hoje,</p>
              <p className="text-[22px] font-medium leading-tight text-ink">{plano.semPrazo?.comSobra ? <>você chega em <b className="font-semibold text-accent-strong">{plano.semPrazo.comSobra.texto}</b></> : "hoje não sobra para essa meta"}</p>
              {plano.semPrazo?.comCoisinhas && <p className="text-[14px] text-ink-muted">Reduzindo as coisinhas dos seus gastos, chega em {plano.semPrazo.comCoisinhas.texto}.</p>}
              <p className="text-[14px] text-ink-muted">Dê uma data para a meta e eu monto o plano.</p>
            </>
          )}
          {plano.situacao === "poucos_dados" && (
            <>
              <p className="text-[15px] font-medium text-ink-muted">Para chegar até {plano.prazoTexto},</p>
              <p className="text-[22px] font-medium leading-tight text-ink">
                faltam <b className="font-semibold text-accent-strong">{m(plano.falta)}</b> por mês
              </p>
              <p className="text-[14px] text-ink-muted">Para achar coisinhas nos seus gastos, preciso de 2 meses fechados.</p>
              <Link href="/mensal" className="flex min-h-[48px] items-center justify-center rounded-full bg-ink px-5 text-[15px] font-semibold text-canvas">
                Lançar ou importar
              </Link>
            </>
          )}
          {plano.situacao === "sem_coisinhas" && (
            <>
              <p className="text-[22px] font-medium leading-tight text-ink">Não achei de onde tirar nos seus gastos</p>
              <p className="text-[14px] text-ink-muted">A meta pede {m(plano.pede ?? 0)} por mês até {plano.prazoTexto}.</p>
              <Link href="/orcamento" className="flex min-h-[48px] items-center justify-center rounded-full bg-ink px-5 text-[15px] font-semibold text-canvas">
                Ver o orçamento
              </Link>
            </>
          )}
          {avisos.map((t) => (
            <Aviso key={t} texto={t} />
          ))}
        </div>
        {voltarMeta}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3" data-plano={plano.situacao}>
      {topo}
      {/* O painel colado no alto: quanto ela já achou e a barra. */}
      <div className="sticky top-[calc(3.6rem+var(--safe-top))] z-30 -mx-5 flex flex-col gap-1.5 bg-canvas px-5 pb-2.5 pt-2 shadow-[0_1px_0_var(--color-border)] md:top-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-[26px] font-medium tabular-nums leading-tight tracking-[-0.02em] text-ink">{m(achado)}</span>
          <small className="text-[13px] font-medium text-ink-muted">achados de {m(falta)}</small>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Barra da meta: ${Math.round(pct)}%`}>
          {pctSobra > 0 && <i className="block h-full bg-success" style={{ width: `${pctSobra}%` }} />}
          <i className={`block h-full transition-[width] duration-300 ${fechou ? "bg-success" : "bg-accent"}`} style={{ width: `${Math.max(0, pct - pctSobra)}%` }} />
        </div>
        <span aria-live="polite" className={`text-[13.5px] font-semibold ${fechou ? "text-success" : "text-accent-strong"}`}>
          {status}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 rounded-[24px] border border-border bg-surface p-4">
        <span className="text-[14.5px] font-medium text-ink-muted">Para chegar até {plano.prazoTexto},</span>
        <span className="text-[22px] font-medium leading-tight text-ink">
          faltam <b className="text-[34px] font-medium tabular-nums tracking-[-0.03em] text-accent-strong">{m(falta)}</b> por mês
        </span>
        {avisos.map((t) => (
          <Aviso key={t} texto={t} />
        ))}
      </div>

      <JaGuardaCartao
        j={plano.jaGuarda}
        trazer={trazer}
        hoje={hojeData}
        m={m}
        onTrazer={(id, valor) => {
          setTrazer((t) => ({ ...t, [id]: valor }));
          setSaida(null);
        }}
      />

      {plano.coisinhas.length > 0 && <span className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">Coisinhas dos seus gastos</span>}
      {plano.coisinhas.map((c) => (
        <ItemDaCoisinha
          key={c.id}
          c={c}
          on={!!sel[c.id]}
          valor={valor(c)}
          economia={economia(c)}
          m={m}
          onToggle={() => {
            setSel((s) => ({ ...s, [c.id]: !s[c.id] }));
            if (sel[c.id]) setVal((v) => Object.fromEntries(Object.entries(v).filter(([k]) => k !== c.id)));
            setSaida(null);
          }}
          onValor={(v) => {
            setVal((x) => ({ ...x, [c.id]: v }));
            setSaida(null);
          }}
        />
      ))}

      {alts && (achado + trazido > 0 || plano.coisinhas.length === 0) && (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Não fechou. Qual caminho?">
          <p className="text-center text-sm font-semibold text-ink">Não fechou. Qual caminho?</p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] gap-2">
            {alts.prazo && <Caminho on={saida === "prazo"} onClick={() => setSaida("prazo")} icone={<Clock size={20} aria-hidden />} titulo={`Chegar em ${alts.prazo.texto}`} sub={`${m(alts.prazo.porMes)} por mês`} />}
            {alts.metaMenor && <Caminho on={saida === "menor"} onClick={() => setSaida("menor")} icone={<MinusCircle size={20} aria-hidden />} titulo={`Meta de ${m(alts.metaMenor.alvo)}`} sub={`${m(alts.metaMenor.porMes)} por mês até ${plano.prazoTexto}`} />}
            {alts.oQueDa && <Caminho on={saida === "daa"} onClick={() => setSaida("daa")} icone={<Route size={20} aria-hidden />} titulo={`Guardar ${m(alts.oQueDa)} por mês`} sub="e rever daqui a 3 meses" />}
          </div>
        </div>
      )}
      <div className="sticky bottom-0 z-30 -mx-5 mt-2 flex flex-col gap-2 bg-canvas px-5 pb-[calc(0.75rem+var(--safe-bottom))] pt-2 shadow-[0_-1px_0_var(--color-border)]">
        {alts && achado + trazido > 0 && !saidaValida && <p className="text-center text-[13px] font-medium text-ink-muted">Não fechou: escolha um caminho logo acima.</p>}
        <button type="button" disabled={!podeUsar || pendente} onClick={usar} className={`flex min-h-[52px] w-full items-center justify-center rounded-full bg-accent px-5 text-base font-bold text-on-accent disabled:opacity-40 ${erro.classe}`}>
          {pendente ? "Salvando…" : erro.erro ? TENTAR_DE_NOVO : "Usar esse plano"}
        </button>
        <ErroNoBotao erro={erro.erro} />
      </div>
    </div>
  );
}

function Caminho({ on, onClick, icone, titulo, sub }: { on: boolean; onClick: () => void; icone: React.ReactNode; titulo: string; sub: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={`flex min-h-[52px] items-start gap-2 rounded-2xl p-2.5 text-left text-[14px] leading-tight ${on ? "bg-accent-soft ring-2 ring-inset ring-accent" : "bg-surface ring-1 ring-inset ring-border"}`}>
      <span className="shrink-0 text-accent-strong">{icone}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="font-semibold text-ink">{titulo}</b>
        <small className="text-[12.5px] tabular-nums text-ink-muted">{sub}</small>
      </span>
    </button>
  );
}

