"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-1" data-tour="temas">
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
            className={`flex min-w-0 flex-col gap-2 rounded-2xl p-2 text-left transition-shadow ${ativo ? "shadow-[inset_0_0_0_2px_var(--color-ink)]" : "shadow-[inset_0_0_0_1px_var(--color-border)]"}`}
          >
            {/* Protótipo: a prévia em degradê do tema (o herói dele), o nome e uma frase curta. */}
            <span className="flex h-16 items-end overflow-hidden rounded-xl p-2" style={{ background: `linear-gradient(145deg, ${p.extras?.["heroi-de"] ?? p.accentSoft}, ${p.extras?.["heroi-para"] ?? p.surface2})` }} aria-hidden>
              <span className="h-2 w-10 rounded-full" style={{ backgroundColor: p.accent }} />
            </span>
            <span className="min-w-0 px-0.5">
              <span className="block text-[15px] font-medium text-ink">{t.label}</span>
              <span className="block text-caption text-ink-muted">{t.descricao.split(".")[0]}.</span>
              {t.nomeDaVoz && <span className="block text-caption font-medium text-ink">Voz: {t.nomeDaVoz}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
