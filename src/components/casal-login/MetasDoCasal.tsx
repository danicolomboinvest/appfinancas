"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useMoney } from "@/components/money/MoneyProvider";
import { criarMetaDoCasalAction } from "@/app/(app)/divisao/nos-dois-actions";
import type { MetaDoCasal } from "@/lib/repositories/nos-dois.repo";
import { BOTAO_ESCURO, CARTAO } from "./visual";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Metas do casal: os dois veem e os dois criam (proposta aprovada, quem vê o quê). */
export function MetasDoCasal({ metas, podeCriar }: { metas: MetaDoCasal[]; podeCriar: boolean }) {
  const money = useMoney();
  const [nova, setNova] = useState(false);
  return (
    <section aria-label="Metas do casal">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-[19px] font-semibold text-ink">Metas a dois</h2>
        {podeCriar && (
          <button type="button" onClick={() => setNova(true)} className="flex min-h-11 items-center gap-1 text-[15px] font-medium text-ink">
            <Plus size={16} strokeWidth={1.8} aria-hidden />
            Nova meta
          </button>
        )}
      </div>
      {metas.length === 0 ? (
        <p className={`${CARTAO} p-5 text-[15px] text-ink-muted`}>Nenhuma meta a dois ainda.</p>
      ) : (
        <ul className={`${CARTAO} divide-y divide-border px-4`}>
          {metas.map((m) => {
            const pct = m.alvo > 0 ? Math.min(100, Math.round((m.guardado / m.alvo) * 100)) : 0;
            return (
              <li key={m.id} className="py-3.5">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink">
                    <Target size={18} strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium text-ink">{m.nome}</span>
                    <span className="block truncate text-[13px] text-ink-muted">
                      {money(m.guardado, { round: true })} de {money(m.alvo, { round: true })}
                      {m.ate ? ` · até ${MESES[Number(m.ate.slice(5, 7)) - 1]}/${m.ate.slice(0, 4)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] tabular-nums text-ink-muted">{pct}%</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-full bg-accent-strong" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <NovaMeta aberto={nova} onClose={() => setNova(false)} />
    </section>
  );
}

function NovaMeta({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [alvo, setAlvo] = useState("");
  const [ate, setAte] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, start] = useTransition();
  const campo = "h-14 w-full rounded-2xl bg-surface px-4 text-[17px] text-ink outline-none shadow-[inset_0_0_0_1px_var(--color-border)]";
  return (
    <Modal open={aberto} onClose={onClose} title="Nova meta a dois">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[15px] text-ink-muted">Para quê</span>
          <input value={nome} onChange={(e) => setNome(e.target.value.slice(0, 40))} placeholder="Apartamento, viagem..." className={campo} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[15px] text-ink-muted">Quanto juntar</span>
          <input value={alvo} onChange={(e) => setAlvo(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="0" className={campo} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[15px] text-ink-muted">Até quando (opcional)</span>
          <input type="month" value={ate} onChange={(e) => setAte(e.target.value)} className={campo} />
        </label>
        {erro && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[15px] text-danger">{erro}</p>}
        <button
          type="button"
          disabled={salvando || !nome || !alvo}
          onClick={() =>
            start(async () => {
              setErro(null);
              const r = await criarMetaDoCasalAction({ nome, alvo, ate });
              if (!r.ok) return setErro(r.mensagem);
              setNome("");
              setAlvo("");
              setAte("");
              onClose();
              router.refresh();
            })
          }
          className={BOTAO_ESCURO}
        >
          {salvando ? "Criando..." : "Criar meta"}
        </button>
      </div>
    </Modal>
  );
}
