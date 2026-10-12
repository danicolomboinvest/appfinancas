"use client";

import { useTransition } from "react";
import { deleteTransactionRuleAction } from "./actions";

export type RegraAprendidaView = { id: string; pattern: string; categoria: string; subcategory: string | null };

/**
 * O que o app aprendeu com as correções dela ("uber eats" → Alimentação). Uma regra errada
 * contaminava toda importação seguinte sem ela ter onde ver nem desfazer.
 */
export function RegrasAprendidas({ regras }: { regras: RegraAprendidaView[] }) {
  if (regras.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Ainda nada. Quando você corrigir a categoria de um gasto que veio de extrato ou fatura, o app guarda aqui e acerta da próxima vez.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {regras.map((r) => (
        <Regra key={r.id} regra={r} />
      ))}
    </ul>
  );
}

function Regra({ regra }: { regra: RegraAprendidaView }) {
  const [isPending, startTransition] = useTransition();
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink" title={regra.pattern}>
          <b className="font-medium">{regra.pattern}</b> → {regra.categoria}
          {regra.subcategory ? `, ${regra.subcategory}` : ""}
        </p>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => deleteTransactionRuleAction(regra.id))}
        aria-label={`Esquecer: ${regra.pattern}`}
        className="min-h-11 shrink-0 px-1 text-sm text-accent-strong transition-opacity hover:underline disabled:opacity-40"
      >
        Esquecer
      </button>
    </li>
  );
}
