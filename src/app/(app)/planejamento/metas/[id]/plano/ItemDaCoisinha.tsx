import { Check } from "lucide-react";
import type { Coisinha } from "@/lib/planning/plano-da-meta";
import { passosDaRegua, textoDaQuantidade, textoDeHoje, ticketArredondado } from "@/lib/planning/plano-da-meta-regua";
import { LogoDaCoisinha } from "./LogoDaCoisinha";

/** Junta o valor e a quantidade: "dá uns 4 pedidos por mês", "dá menos de 1 pedido por mês", "do jeito que está". */
export function quantidade(c: Coisinha, v: number): string {
  const t = textoDaQuantidade(c, v) ?? "";
  return /^menos/.test(t) ? `dá ${t}` : t;
}

/** Uma coisinha: o cartão para marcar e, marcada (e não assinatura), a régua de quanto gastar. */
export function ItemDaCoisinha({ c, on, valor, economia, m, onToggle, onValor }: { c: Coisinha; on: boolean; valor: number; economia: number; m: (v: number) => string; onToggle: () => void; onValor: (v: number) => void }) {
  const passos = passosDaRegua(c.hoje);
  const i = Math.max(0, passos.findIndex((v) => Math.abs(v - valor) < 0.005));
  const pct = passos.length > 1 ? (i / (passos.length - 1)) * 100 : 100;
  const hoje = textoDeHoje(c);
  const ticket = c.ticket ? m(ticketArredondado(c.ticket)) : null;
  const custa = ticket ? (c.tipo === "delivery" ? `o seu custa uns ${ticket}` : c.tipo === "corrida" ? `a sua custa uns ${ticket}` : `cada vez custa uns ${ticket}`) : null;
  const falado = `${m(valor)} por mês, ${valor >= c.hoje ? "do jeito que está" : `economiza ${m(economia)}, ${quantidade(c, valor)}`}`;
  const idDaRegua = `regua-${c.id.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <div className={`flex flex-col rounded-[18px] transition-colors ${on ? "bg-accent-soft ring-2 ring-inset ring-accent" : "bg-surface ring-1 ring-inset ring-border"}`} data-coisinha={c.id}>
      <button type="button" aria-pressed={on} onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        <LogoDaCoisinha marca={c.marca} tipo={c.tipo} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="text-[15.5px] font-semibold text-ink">
            {c.nome}
            {c.nivel === 2 && <span className="ml-1.5 inline-block rounded-full bg-surface-2 px-1.5 align-[2px] text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">dia a dia</span>}
            {c.daCasa && <span className="ml-1.5 inline-block rounded-full bg-surface-2 px-1.5 align-[2px] text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">da casa</span>}
          </b>
          <small className="text-[13px] tabular-nums text-ink-muted">
            {c.acao === "cancelar" ? (
              <>{m(c.hoje)} · cancelar</>
            ) : (
              <>
                {m(c.hoje)} para <b className="font-semibold text-ink">{m(valor)}</b>
              </>
            )}
          </small>
          {c.acao === "cancelar" ? <small className="text-[13px] text-ink-muted">Você marcou para cancelar</small> : c.lojas.length > 0 ? <small className="text-[13px] text-ink-muted">{c.lojas.join(", ")}</small> : hoje && <small className="text-[13px] text-ink-muted">{hoje}</small>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="whitespace-nowrap rounded-full bg-success-soft px-2 py-0.5 text-[13px] font-bold tabular-nums text-success">+{m(economia)}</span>
          <span className={`flex size-6 items-center justify-center rounded-full ${on ? "bg-accent text-on-accent" : "ring-2 ring-inset ring-border-strong"}`} aria-hidden>
            {on && <Check size={14} strokeWidth={3} />}
          </span>
        </span>
      </button>
      {on && c.acao === "reduzir" && (
        <div className="flex flex-col gap-1 px-3.5 pb-3.5">
          <label htmlFor={idDaRegua} className="text-[12.5px] font-bold text-ink-muted">
            Quanto quer gastar com {c.nome} por mês?
          </label>
          <input
            id={idDaRegua}
            type="range"
            min={0}
            max={passos.length - 1}
            step={1}
            value={i}
            aria-valuetext={falado}
            onChange={(e) => onValor(passos[Number(e.target.value)] ?? c.para)}
            className="regua-do-plano"
            style={{ ["--p" as string]: `${pct}%` }}
          />
          <span className="text-[14px] font-medium tabular-nums text-ink">
            <b className="text-[18px] font-semibold">{m(valor)}</b> {valor >= c.hoje ? "· do jeito que está" : quantidade(c, valor)}
          </span>
          {(custa || hoje) && <small className="text-[12.5px] tabular-nums text-ink-muted">{[custa, hoje].filter(Boolean).join(" · ")}</small>}
        </div>
      )}
    </div>
  );
}
