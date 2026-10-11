"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { PROFILE_THEMES, type ProfileThemeKey } from "@/lib/profiles/themes";
import { editarPerfilAction } from "@/app/(app)/perfis/actions";
import { useToast } from "@/components/ui/toast-context";

/**
 * "Estilo do app" dentro de Configurações › Aparência (versão nova, 11/10/2026): os quatro temas
 * lado a lado, cada um com o logo Aurora dele e uma miniatura do claro. Um toque troca o tema do
 * perfil que está aberto; o app muda na hora.
 */
export function EscolherEstilo({ perfilId, atual }: { perfilId: string; atual: ProfileThemeKey }) {
  const [escolhido, setEscolhido] = useState(atual);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const { showError } = useToast();

  return (
    <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-1">
      {PROFILE_THEMES.map((t) => {
        const ativo = escolhido === t.key;
        const p = t.paleta;
        return (
          <button
            key={t.key}
            type="button"
            disabled={pendente}
            aria-pressed={ativo}
            onClick={() => {
              if (ativo) return;
              const antes = escolhido;
              setEscolhido(t.key);
              iniciar(async () => {
                const r = await editarPerfilAction(perfilId, { theme: t.key });
                if (!r.ok) {
                  setEscolhido(antes);
                  showError(r.error);
                  return;
                }
                router.refresh();
              });
            }}
            className={`flex min-w-0 flex-col gap-2 rounded-2xl border p-2.5 text-left transition-colors ${ativo ? "border-accent" : "border-border hover:border-border-strong"}`}
          >
            <span className="relative flex h-16 items-end gap-1.5 overflow-hidden rounded-xl p-2" style={{ backgroundColor: p.canvas }} aria-hidden>
              <span className="size-7 shrink-0 rounded-lg bg-cover" style={{ backgroundImage: `url(${t.logo}/icone.svg)` }} />
              <span className="flex min-w-0 flex-1 flex-col gap-1 rounded-md p-1.5" style={{ backgroundColor: p.surface }}>
                <span className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: p.ink, opacity: 0.8 }} />
                <span className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: p.accent }} />
              </span>
              {ativo && (
                <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Check size={12} strokeWidth={2.5} />
                </span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium text-ink">{t.label}</span>
              <span className="block text-caption text-ink-muted">{t.descricao}</span>
              {t.nomeDaVoz && <span className="block text-caption font-medium text-ink">Voz: {t.nomeDaVoz}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
