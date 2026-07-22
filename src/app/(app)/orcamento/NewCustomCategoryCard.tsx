"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CUSTOM_CATEGORY_ICON_OPTIONS, DEFAULT_CUSTOM_CATEGORY_ICON_KEY } from "@/lib/categories";
import { createCustomCategoryAction, type CustomCategoryState } from "./actions";

const initialState: CustomCategoryState = {};

/** Card "+ Nova categoria", abre um modal com nome + escolha de ícone. */
export function NewCustomCategoryCard() {
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState(DEFAULT_CUSTOM_CATEGORY_ICON_KEY);
  const [state, formAction, isPending] = useActionState(createCustomCategoryAction, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong p-5 text-ink-muted transition-colors hover:border-accent hover:text-accent-strong"
      >
        <Plus size={22} />
        <span className="text-sm font-medium">Nova categoria</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova categoria">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="icon" value={icon} />
          {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}

          <Field label="Nome da categoria" name="name" required placeholder="Ex.: Viagens" />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">Ícone</span>
            <div className="grid grid-cols-5 gap-2">
              {CUSTOM_CATEGORY_ICON_OPTIONS.map((option) => {
                const OptionIcon = option.icon;
                const active = icon === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setIcon(option.key)}
                    title={option.label}
                    className={`flex h-10 w-full items-center justify-center rounded-lg border transition-colors ${
                      active
                        ? "border-accent bg-accent-soft text-accent-strong"
                        : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"
                    }`}
                  >
                    <OptionIcon size={17} />
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending ? "Criando..." : "Criar categoria"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
