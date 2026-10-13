import { DuasBolinhas } from "@/components/casa/Pessoas";
import type { CasaNaTela } from "@/lib/casa/regras";

/** As metas a dois do Nós dois de antes, para os dois acompanharem (Casal simples). */
export function MetasADois({ metas, casa, money }: { metas: { id: string; nome: string; foto: string; alvo: number; guardado: number; pct: number }[]; casa: CasaNaTela; money: (v: number) => string }) {
  if (metas.length === 0) return null;
  return (
    <section className="flex flex-col gap-2.5" data-metas-a-dois>
      <h2 className="flex items-center gap-2 px-1 text-[15px] font-medium text-ink">
        A dois <DuasBolinhas casa={casa} size={22} />
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
        {metas.map((m) => {
          const pct = Math.max(0, Math.min(100, Math.round(m.pct)));
          return (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.foto} alt="" className="size-11 shrink-0 rounded-2xl object-cover" />
              <span className="min-w-0 flex-1">
                <b className="block break-words text-[15px] font-medium text-ink">{m.nome}</b>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </span>
                <small className="mt-1 block text-[13px] tabular-nums text-ink-muted">
                  {money(m.guardado)} de {money(m.alvo)}
                </small>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
