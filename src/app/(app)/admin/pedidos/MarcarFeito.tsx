"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarPedidoFeitoAction } from "@/lib/cancelar/actions";

export function MarcarFeito({ id, rotulo }: { id: string; rotulo: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => iniciar(async () => { await marcarPedidoFeitoAction(id); router.refresh(); })}
      className="mt-1 min-h-11 self-start rounded-full bg-accent-gradient px-5 text-sm font-medium text-on-accent disabled:opacity-60"
    >
      {rotulo}
    </button>
  );
}
