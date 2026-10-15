"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirAssessoriaAction } from "@/lib/assessoria/admin-actions";

export function BotoesDaEquipe({ userId, confirmada }: { userId: string; confirmada: boolean }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const decidir = (decisao: "confirmar" | "nao_achou" | "desfazer") =>
    iniciar(async () => {
      await decidirAssessoriaAction(userId, decisao);
      router.refresh();
    });

  if (confirmada) {
    return (
      <button type="button" disabled={pendente} onClick={() => decidir("desfazer")} className="min-h-11 self-start text-sm text-ink-muted underline underline-offset-2 disabled:opacity-60">
        Desfazer
      </button>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-4">
      <button
        type="button"
        disabled={pendente}
        onClick={() => decidir("confirmar")}
        className="min-h-11 rounded-full bg-accent-gradient px-5 text-sm font-medium text-on-accent disabled:opacity-60"
      >
        Confirmada na EQI
      </button>
      <button type="button" disabled={pendente} onClick={() => decidir("nao_achou")} className="min-h-11 text-sm text-ink-muted underline underline-offset-2 disabled:opacity-60">
        Não achou a conta
      </button>
    </div>
  );
}
