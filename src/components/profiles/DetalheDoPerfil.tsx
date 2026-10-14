"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-context";
import { editarPerfilAction, excluirPerfilAction, trocarPerfilAction } from "@/app/(app)/perfis/actions";
import type { ProfileRow } from "@/lib/repositories/profile.repo";
import { ConfirmarExclusao } from "./ProfilesManager";

/**
 * O detalhe de um perfil (Configurações › Perfis › um perfil): o nome, usar este perfil e, no fim
 * e discreto, apagar. O tema fica logo abaixo, na mesma tela (EscolherEstilo).
 */
export function DetalheDoPerfil({ perfil, emUso, podeApagar }: { perfil: ProfileRow; emUso: boolean; podeApagar: boolean }) {
  const [nome, setNome] = useState(perfil.name);
  const [apagando, setApagando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const { showToast, showError } = useToast();
  const mudou = nome.trim() !== perfil.name && nome.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 rounded-3xl border border-border bg-surface p-4">
        <span className="text-[13px] text-ink-muted">Nome</span>
        <input
          value={nome}
          maxLength={40}
          onChange={(e) => setNome(e.target.value)}
          className="min-h-12 rounded-2xl border border-border bg-surface-2 px-4 text-[17px] text-ink outline-none focus:border-ink"
        />
        {mudou && (
          <button
            type="button"
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                const r = await editarPerfilAction(perfil.id, { name: nome.trim() });
                if (!r.ok) return showError(r.error ?? "Não salvou. Tente de novo.");
                // Sem aviso: o botão some e o nome novo fica.
                router.refresh();
              })
            }
            className="mt-1 min-h-11 rounded-full bg-ink text-[15px] font-medium text-canvas disabled:opacity-60"
          >
            Salvar o nome
          </button>
        )}
      </label>

      {emUso ? (
        <p className="px-1 text-sm text-ink-muted">Este é o perfil em uso agora.</p>
      ) : (
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await trocarPerfilAction(perfil.id);
              if (!r.ok) return showError(r.error ?? "Não trocou. Tente de novo.");
              // A troca de perfil muda a tela inteira: pílula curta.
              showToast(`Agora em ${perfil.name}`);
              router.push("/mensal/foco");
            })
          }
          className="min-h-12 rounded-full border border-border-strong bg-surface text-[15px] font-medium text-ink disabled:opacity-60"
        >
          Usar este perfil
        </button>
      )}

      {podeApagar && (
        <button type="button" onClick={() => setApagando(true)} className="mx-auto mt-6 min-h-11 px-3 text-sm text-ink-muted underline-offset-2 hover:text-danger hover:underline">
          Apagar este perfil
        </button>
      )}
      {apagando && (
        <ConfirmarExclusao
          perfil={perfil}
          pendente={pendente}
          onFechar={() => setApagando(false)}
          onConfirmar={() =>
            iniciar(async () => {
              const r = await excluirPerfilAction(perfil.id);
              if (!r.ok) return showError(r.error ?? "Não apagou. Tente de novo.");
              // Sem aviso: a lista de perfis abre sem ele.
              router.push("/configuracoes/perfis");
            })
          }
        />
      )}
    </div>
  );
}
