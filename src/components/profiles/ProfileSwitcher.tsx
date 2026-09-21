"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ProfileIcon } from "./ProfileIcon";
import { profileColor } from "@/lib/profiles/palette";
import { trocarPerfilAction } from "@/app/(app)/perfis/actions";

export type PerfilResumo = { id: string; name: string; icon: string; color: string; isDefault: boolean };

/**
 * A troca de perfil, no alto de toda tela.
 *
 * Fica ao lado do sol/lua e não dentro de um menu porque o pedido é que o perfil ativo esteja
 * SEMPRE claro: quem está lançando um gasto precisa ver, sem procurar, se está no Pessoal ou na
 * Empresa. Lançar na conta errada é o erro mais caro que este recurso pode causar.
 *
 * Some quando só existe um perfil. Enquanto a pessoa não separou nada, uma etiqueta escrita
 * "Pessoal" no alto de tudo é ruído — o recurso aparece quando passa a significar algo.
 */
export function ProfileSwitcher({ perfis }: { perfis: PerfilResumo[] }) {
  const [aberto, setAberto] = useState(false);
  const [trocando, iniciarTroca] = useTransition();
  const ativo = perfis.find((p) => p.isDefault) ?? perfis[0];

  if (!ativo || perfis.length <= 1) return null;

  function trocar(id: string) {
    if (id === ativo?.id) {
      setAberto(false);
      return;
    }
    iniciarTroca(async () => {
      await trocarPerfilAction(id);
      setAberto(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={trocando}
        className="inline-flex max-w-[60vw] items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1 pl-2.5 pr-2 text-sm text-ink transition-colors hover:border-border-strong disabled:opacity-60"
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `var(--color-accent-soft)` }}>
          <ProfileIcon name={ativo.icon} size={12} className="text-accent" />
        </span>
        <span className="truncate font-medium">{ativo.name}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-faint" />
      </button>

      <Modal open={aberto} onClose={() => setAberto(false)} title="Seus perfis">
        <div className="flex flex-col gap-1.5">
          {perfis.map((p) => {
            const cor = profileColor(p.color);
            const eAtivo = p.id === ativo.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => trocar(p.id)}
                disabled={trocando}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                  eAtivo ? "border-border-strong bg-surface-2" : "border-border hover:bg-surface-2"
                }`}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `rgba(${cor.dark.rgb}, 0.18)`, color: cor.dark.accent }}
                >
                  <ProfileIcon name={p.icon} size={18} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.name}</span>
                {eAtivo && <Check size={16} className="shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>

        <Link
          href="/perfis"
          onClick={() => setAberto(false)}
          className="mt-3 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
        >
          <Settings2 size={16} />
          Gerenciar perfis
        </Link>
      </Modal>
    </>
  );
}
