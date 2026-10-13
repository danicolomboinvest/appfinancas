"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { MESES_CURTOS } from "@/lib/empresa/resumo";
import { mesAntes } from "@/lib/empresa/regras";
import {
  anoSo,
  atalhosDeDatas,
  hrefDoPeriodo,
  periodoDoTipo,
  primeiroDia,
  rotuloDoPeriodo,
  ultimoDia,
  umMesSo,
  type PeriodoDaEmpresa,
  type TipoDoPeriodo,
} from "@/lib/empresa/periodo";

const CHIPS: [Exclude<TipoDoPeriodo, "datas">, string][] = [
  ["mes", "Este mês"],
  ["mes-passado", "Mês passado"],
  ["ano", "Este ano"],
  ["12m", "Últimos 12 meses"],
];

/**
 * "‹ Mês passado · set 2026 ▾ ›": o seletor de período da Empresa, no visual do seletor de mês das
 * Transações. As setas andam um mês (ou um ano, no ano inteiro). Tocar no nome abre "Ver o
 * período": Este mês, Mês passado, Este ano, Últimos 12 meses e Escolher datas (atalhos de mês e
 * de ano, ou de/até). O período vai no endereço (?periodo= ou ?de=&ate=), para voltar e compartilhar.
 * `periodo` nulo: a tela está no padrão dela, que não é um período (o "Como vai").
 */
export function SeletorDePeriodo({ periodo, hoje, caminho, manter = {}, semPeriodo }: { periodo: PeriodoDaEmpresa | null; hoje: string; caminho: string; manter?: Record<string, string>; semPeriodo?: { nome: string; sub: string } }) {
  const router = useRouter();
  const [folha, setFolha] = useState(false);
  const [datas, setDatas] = useState(false);
  const atual = { ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) };
  const rotulo = periodo ? rotuloDoPeriodo(periodo, hoje) : (semPeriodo ?? { nome: "Escolher período", sub: "" });
  const mes = periodo ? umMesSo(periodo, hoje) : null;
  const ano = periodo && !mes ? anoSo(periodo, hoje) : null;

  const deMes = (m: { ano: number; mes: number }) => `de=${primeiroDia(m)}&ate=${ultimoDia(m)}`;
  const deAno = (a: number) => `de=${a}-01-01&ate=${a}-12-31`;
  let antes: string | null = null;
  let depois: string | null = null;
  if (mes) {
    const a = mesAntes(mes, 1);
    if (a.ano >= 2000) antes = hrefDoPeriodo(caminho, deMes(a), manter);
    const d = mesAntes(mes, -1);
    if (d.ano * 12 + d.mes <= atual.ano * 12 + atual.mes) depois = hrefDoPeriodo(caminho, deMes(d), manter);
  } else if (ano !== null) {
    if (ano > 2000) antes = hrefDoPeriodo(caminho, deAno(ano - 1), manter);
    if (ano < atual.ano) depois = hrefDoPeriodo(caminho, deAno(ano + 1), manter);
  }

  const ir = (q: string) => {
    setFolha(false);
    setDatas(false);
    router.push(hrefDoPeriodo(caminho, q, manter), { scroll: false });
  };
  const seta = "flex size-11 shrink-0 items-center justify-center rounded-full text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)] transition-colors hover:bg-surface-2";
  const apagada = "flex size-11 shrink-0 items-center justify-center rounded-full text-ink-faint opacity-40 shadow-[inset_0_0_0_1px_var(--color-border)]";
  const noChip = (t: Exclude<TipoDoPeriodo, "datas">) => {
    if (!periodo) return false;
    const c = periodoDoTipo(t, hoje);
    return c.de === periodo.de && c.ate === periodo.ate;
  };

  return (
    <>
      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2" aria-label="Período" data-seletor-periodo>
        {antes ? (
          <Link href={antes} aria-label={mes ? "Mês anterior" : "Ano anterior"} className={seta} scroll={false}>
            <ChevronLeft size={18} aria-hidden />
          </Link>
        ) : (
          <span className={apagada} aria-hidden>
            <ChevronLeft size={18} />
          </span>
        )}
        <button type="button" aria-haspopup="dialog" onClick={() => setFolha(true)} className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full px-2 text-ink" data-periodo-nome>
          <span className="flex min-w-0 flex-wrap items-baseline justify-center gap-x-1.5 leading-tight">
            <b className="whitespace-nowrap text-[15px] font-medium">{rotulo.nome}</b>
            {rotulo.sub && <small className="whitespace-nowrap text-[13px] text-ink-muted">{rotulo.sub}</small>}
          </span>
          <ChevronDown size={16} className="shrink-0 text-ink-muted" aria-hidden />
        </button>
        {depois ? (
          <Link href={depois} aria-label={mes ? "Próximo mês" : "Próximo ano"} className={seta} scroll={false}>
            <ChevronRight size={18} aria-hidden />
          </Link>
        ) : (
          <span className={apagada} aria-hidden>
            <ChevronRight size={18} />
          </span>
        )}
      </div>
      <Modal
        open={folha}
        onClose={() => {
          setFolha(false);
          setDatas(false);
        }}
        title={datas ? "Escolher datas" : "Ver o período"}
        voltar={datas ? () => setDatas(false) : undefined}
      >
        {datas ? (
          <EscolherDatas hoje={hoje} inicial={periodo} onVer={ir} />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2" data-periodo-chips>
              {CHIPS.map(([t, nome]) => (
                <button key={t} type="button" aria-pressed={noChip(t)} onClick={() => ir(`periodo=${t}`)} className="min-h-[46px] rounded-full bg-surface-2 px-3 text-[15px] text-ink aria-pressed:bg-ink aria-pressed:text-surface">
                  {nome}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDatas(true)}
              data-escolher-datas
              className={`flex min-h-14 items-center gap-3 rounded-2xl bg-surface pl-2.5 pr-4 text-left text-base text-ink ${periodo?.tipo === "datas" && !mes ? "shadow-[inset_0_0_0_1.5px_var(--color-ink)]" : "shadow-[inset_0_0_0_1px_var(--color-border)]"}`}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-surface-2">
                <CalendarDays size={18} aria-hidden />
              </span>
              Escolher datas
              <ChevronRight size={16} className="ml-auto text-ink-muted" aria-hidden />
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Escolher datas: o ano, depois um mês dele (ou o ano inteiro); ou os dias de/até. */
function EscolherDatas({ hoje, inicial, onVer }: { hoje: string; inicial: PeriodoDaEmpresa | null; onVer: (q: string) => void }) {
  const [anoVisto, setAnoVisto] = useState(inicial ? Number(inicial.ate.slice(0, 4)) : Number(hoje.slice(0, 4)));
  const [de, setDe] = useState(inicial?.tipo === "datas" ? inicial.de : "");
  const [ate, setAte] = useState(inicial?.tipo === "datas" ? inicial.ate : "");
  const { meses, anos } = atalhosDeDatas(hoje, anoVisto);
  const pill = "min-h-11 rounded-full px-3 text-[15px] text-ink aria-pressed:bg-ink aria-pressed:text-surface disabled:opacity-35";
  const campo = "min-h-12 w-full min-w-0 rounded-2xl border border-border-strong bg-surface-2 px-3 text-[15px] text-ink focus:border-accent focus:outline-none";
  const valido = !!de && !!ate && de <= hoje;
  return (
    <div className="flex flex-col gap-4" data-escolher-datas-folha>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ano">
        {anos.map((a) => (
          <button key={a} type="button" aria-pressed={a === anoVisto} onClick={() => setAnoVisto(a)} className={`${pill} bg-surface-2 tabular-nums`}>
            {a}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onVer(`de=${anoVisto}-01-01&ate=${anoVisto}-12-31`)} className="min-h-12 rounded-2xl bg-accent-soft px-4 text-[15px] font-medium text-ink">
        {anoVisto} inteiro
      </button>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label={`Meses de ${anoVisto}`}>
        {meses.map((x) => (
          <button key={x.de} type="button" disabled={x.futuro} onClick={() => onVer(`de=${x.de}&ate=${x.ate}`)} className={`${pill} bg-surface-2`}>
            {MESES_CURTOS[x.m.mes - 1]}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-muted">Ou os dias</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-muted">
            De
            <input type="date" value={de} min="2000-01-01" max={hoje} onChange={(e) => setDe(e.target.value)} className={campo} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-muted">
            Até
            <input type="date" value={ate} min={de || "2000-01-01"} max={hoje} onChange={(e) => setAte(e.target.value)} className={campo} />
          </label>
        </div>
        <button type="button" disabled={!valido} onClick={() => onVer(`de=${de}&ate=${ate}`)} className="min-h-12 rounded-full bg-ink text-base font-medium text-surface disabled:opacity-40">
          Ver
        </button>
      </div>
    </div>
  );
}
