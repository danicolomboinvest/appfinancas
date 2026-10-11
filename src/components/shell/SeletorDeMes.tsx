"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { hrefDoMes, mesAoLado, mesesDaFolha, mesmoMes, periodoDaRota, rotuloDoPeriodo } from "@/lib/visao-geral/periodo";

/**
 * "‹ Esse mês · 1 a 11 out ›" logo abaixo das abas (protótipo aprovado, tema-padrao.html e
 * tema-girly.html). As setas andam um mês; tocar no nome abre "Ver o período" com os últimos 12
 * meses. Vale para Resumo, Orçamento e Transações (Recorrentes não tem mês). O mês viaja na URL
 * (ver lib/visao-geral/periodo.ts), então trocar de aba mantém o mês escolhido.
 */
export function SeletorDeMes() {
  const caminho = usePathname();
  const busca = useSearchParams();
  const [folha, setFolha] = useState(false);
  const agora = nowInBrazil();
  const periodo = periodoDaRota(caminho, busca.get("mes"), agora);
  if (!periodo) return null;
  const { aba, mes } = periodo;
  const rotulo = rotuloDoPeriodo(mes, agora);
  const antes = mesAoLado(mes, -1, agora);
  const depois = mesAoLado(mes, 1, agora);
  const seta = "flex size-11 shrink-0 items-center justify-center rounded-full text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)] transition-colors hover:bg-surface-2";
  const apagada = "flex size-11 shrink-0 items-center justify-center rounded-full text-ink-faint opacity-40 shadow-[inset_0_0_0_1px_var(--color-border)]";

  return (
    <>
      <div className="-mt-2 mb-4 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2" aria-label="Mês">
        {antes ? (
          <Link href={hrefDoMes(aba, antes, agora)} aria-label="Mês anterior" className={seta} scroll={false}>
            <ChevronLeft size={18} aria-hidden />
          </Link>
        ) : (
          <span className={apagada} aria-hidden>
            <ChevronLeft size={18} />
          </span>
        )}
        <button
          type="button"
          data-periodo-nome
          aria-haspopup="dialog"
          onClick={() => setFolha(true)}
          className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full px-2 text-ink"
        >
          <span className="flex min-w-0 flex-wrap items-baseline justify-center gap-x-1.5 leading-tight">
            <b className="whitespace-nowrap text-[15px] font-medium">{rotulo.nome}</b>
            <small className="whitespace-nowrap text-[13px] text-ink-muted">{rotulo.sub}</small>
          </span>
          <ChevronDown size={16} className="shrink-0 text-ink-muted" aria-hidden />
        </button>
        {depois ? (
          <Link href={hrefDoMes(aba, depois, agora)} aria-label="Próximo mês" className={seta} scroll={false}>
            <ChevronRight size={18} aria-hidden />
          </Link>
        ) : (
          <span className={apagada} aria-hidden>
            <ChevronRight size={18} />
          </span>
        )}
      </div>
      <Modal open={folha} onClose={() => setFolha(false)} title="Ver o período">
        <ul className="flex flex-col divide-y divide-border">
          {mesesDaFolha(agora).map((m) => {
            const r = rotuloDoPeriodo(m, agora);
            const on = mesmoMes(m, mes);
            return (
              <li key={`${m.ano}-${m.mes}`}>
                <Link
                  href={hrefDoMes(aba, m, agora)}
                  onClick={() => setFolha(false)}
                  aria-current={on ? "true" : undefined}
                  className={`flex min-h-12 items-center justify-between gap-3 px-1 text-[15px] ${on ? "font-semibold text-ink" : "text-ink"}`}
                >
                  <span>{r.nome}</span>
                  <span className="text-sm text-ink-muted">{r.sub}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
}
