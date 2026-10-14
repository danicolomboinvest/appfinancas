"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { ProfileKind } from "@prisma/client";
import { useToast } from "@/components/ui/toast-context";
import { criarPerfilAction } from "@/app/(app)/perfis/actions";
import { FormularioPerfil } from "./ProfilesManager";

/** "Novo perfil" num lugar fixo (Pessoal, Nós dois, Empresa): abre o formulário com o tipo já escolhido. */
export function NovoPerfilNoLugar({ kind, nome, rotulo }: { kind: ProfileKind; nome: string; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const { showError } = useToast();
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-[15px] text-ink hover:bg-surface-hover">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted" aria-hidden>
          <Plus size={17} />
        </span>
        <span className="flex-1">{rotulo}</span>
      </button>
      {aberto && (
        <FormularioPerfil
          perfil={null}
          inicial={{ kind, name: nome }}
          pendente={pendente}
          onFechar={() => setAberto(false)}
          onSalvar={(dados) =>
            iniciar(async () => {
              const r = await criarPerfilAction(dados);
              if (!r.ok) return showError(r.error ?? "Não criou. Tente de novo.");
              // Sem aviso: o perfil novo aparece no lugar.
              setAberto(false);
              router.refresh();
            })
          }
        />
      )}
    </>
  );
}
