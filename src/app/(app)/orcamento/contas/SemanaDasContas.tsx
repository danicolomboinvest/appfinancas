"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { Explica } from "@/components/ui/Explica";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { semanaDasContas, type ContaDaSemana } from "@/lib/contas/semana-das-contas";
import { useAbrirConta } from "./folha-contexto";
import { iconeDaConta } from "./icone-da-conta";

/**
 * "Saem nesta semana" (rodada 4): o total, a fita dos 7 dias com um ponto onde vence conta, as
 * setas até 30 dias. Tocar no dia mostra as contas dele e "Adicionar conta neste dia".
 */
export function SemanaDasContas({ contas, hoje }: { contas: ContaDaSemana[]; hoje: string }) {
  const money = useMoney();
  const abrir = useAbrirConta();
  const [semana, setSemana] = useState(0);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const s = semanaDasContas(contas, hoje, semana);
  const aberto = s.dias.find((d) => d.iso === diaAberto);
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 text-sm text-ink-muted">{semana === 0 ? `Esta semana · ${s.intervalo}` : `Saem ${s.intervalo}`}</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" aria-label="Semana anterior" disabled={semana === 0} onClick={() => { setSemana(semana - 1); setDiaAberto(null); }} className="flex size-10 items-center justify-center rounded-full border border-border text-ink disabled:opacity-35">
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button type="button" aria-label="Próxima semana" disabled={semana >= 3} onClick={() => { setSemana(semana + 1); setDiaAberto(null); }} className="flex size-10 items-center justify-center rounded-full border border-border text-ink disabled:opacity-35">
            <ChevronRight size={16} aria-hidden />
          </button>
          <Explica>O que vence em cada dia, até 30 dias à frente. Toque num dia para ver as contas dele ou cadastrar uma ali.</Explica>
        </div>
      </div>
      <p className="text-ink">
        <ValorDestaque texto={`${s.aproximado ? "~" : ""}${money(s.total)}`} className="text-[1.75rem] font-light tabular-nums" />
      </p>
      <div className="grid grid-cols-7 gap-1">
        {s.dias.map((d) => {
          const on = d.iso === diaAberto;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => setDiaAberto(on ? null : d.iso)}
              aria-pressed={on}
              aria-label={`${d.sigla} ${d.dia}: ${d.contas.length === 0 ? "nada vence" : d.contas.map((c) => c.nome).join(", ")}`}
              className={`flex min-w-0 flex-col items-center gap-0.5 rounded-2xl py-2 ${d.hoje ? "bg-ink text-canvas" : on ? "bg-surface text-ink ring-[1.5px] ring-accent" : "bg-surface-2 text-ink"}`}
            >
              <span className="text-xs opacity-80">{d.sigla}</span>
              <span className="text-[17px] tabular-nums">{d.dia}</span>
              <span className={`size-1.5 rounded-full ${d.contas.length > 0 ? (d.hoje ? "bg-canvas" : "bg-accent") : "bg-transparent"}`} aria-hidden />
            </button>
          );
        })}
      </div>
      {aberto && (
        <div className="flex flex-col gap-1 px-1" data-dia-aberto>
          {/* Protótipo: o dia por extenso em cima, as contas e a pílula de adicionar. */}
          <b className="pt-1 text-[15px] font-medium text-ink">
            {(() => {
              const t = new Date(`${aberto.iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
              return t.charAt(0).toUpperCase() + t.slice(1);
            })()}
          </b>
          {aberto.contas.length === 0 ? (
            <p className="py-3 text-sm text-ink-muted">Nada vence neste dia.</p>
          ) : (
            <ul className="divide-y divide-border">
              {aberto.contas.map((c) => (
                <li key={c.chave ?? c.id} className="flex items-center gap-3 py-2.5">
                  <LogoDoLancamento descricao={c.nome} icon={iconeDaConta(c.nome)} cor="var(--color-ink-muted)" size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[15px] leading-snug text-ink">{c.nome}</span>
                    {c.detalhe && <span className="block text-[13px] text-ink-muted">{c.detalhe}</span>}
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums text-ink">{c.valor === null ? "varia" : `${c.aproximado ? "~" : ""}${money(c.valor)}`}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => abrir({ dia: aberto.iso })} className="mt-1 flex min-h-10 w-fit items-center gap-1.5 rounded-full bg-surface-2 px-4 text-sm text-ink">
            <Plus size={16} aria-hidden /> Adicionar conta neste dia
          </button>
        </div>
      )}
    </section>
  );
}
