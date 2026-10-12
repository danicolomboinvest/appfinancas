"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editarPerfilAction } from "@/app/(app)/perfis/actions";
import { useToast } from "@/components/ui/toast-context";
import type { ProfileThemeKey } from "@/lib/profiles/themes";

export function EscolherVoz({ perfilId, atual, vozes }: { perfilId: string; atual: ProfileThemeKey; vozes: { key: ProfileThemeKey; nome: string; frase: string | null }[] }) {
  const [escolhida, setEscolhida] = useState(atual);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const { showError } = useToast();
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
      {vozes.map((v) => {
        const on = v.key === escolhida;
        return (
          <li key={v.key}>
            <button
              type="button"
              aria-pressed={on}
              disabled={pendente}
              onClick={() => {
                if (on) return;
                const antes = escolhida;
                setEscolhida(v.key);
                iniciar(async () => {
                  const r = await editarPerfilAction(perfilId, { theme: v.key });
                  if (!r.ok) {
                    setEscolhida(antes);
                    return showError(r.error);
                  }
                  router.refresh();
                });
              }}
              className={`flex w-full items-start gap-3 px-4 py-3.5 text-left ${on ? "bg-surface-2" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] text-ink">{v.nome}</span>
                {v.frase && <span className="mt-0.5 block text-sm text-ink-muted">&ldquo;{v.frase}&rdquo;</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
