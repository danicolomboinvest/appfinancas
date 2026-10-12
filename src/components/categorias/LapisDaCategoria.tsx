"use client";

import { useRef, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { EditarPropria } from "@/app/(app)/configuracoes/categorias/EditorDeCategorias";

type Propria = { id: string; name: string; icon: string };

/**
 * A categoria que a pessoa criou, editável ali mesmo (pedido da dona, 12/10/2026): um lápis pequeno
 * no canto do bloco, ou o toque longo, abrem a folha da categoria já preenchida (nome, ícone, cor,
 * "É essencial") com "Salvar" e, no fim, "Apagar categoria". As categorias padrão não passam por
 * aqui: elas só se escondem, em Configurações › Categorias.
 */
export function LapisDaCategoria({ categoria, outras = [], children, className = "" }: { categoria: Propria; outras?: Propria[]; children: ReactNode; className?: string }) {
  const [aberta, setAberta] = useState(false);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segurou = useRef(false);
  const soltar = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <div
      className={`relative ${className}`}
      data-categoria-propria={categoria.id}
      onPointerDown={() => {
        if (aberta) return;
        segurou.current = false;
        timer.current = setTimeout(() => {
          segurou.current = true;
          try {
            navigator.vibrate?.(10);
          } catch {}
          setAberta(true);
        }, 550);
      }}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onContextMenu={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        // O toque longo abre a folha; o clique que vem depois dele não escolhe a categoria.
        // Com a folha aberta, os toques são dela (o portal da folha também passa por aqui).
        if (segurou.current && !aberta) {
          e.preventDefault();
          e.stopPropagation();
        }
        segurou.current = false;
      }}
    >
      {children}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAberta(true);
        }}
        aria-label={`Editar a categoria ${categoria.name}`}
        className="absolute -right-1 -top-1 z-[1] flex size-7 items-center justify-center rounded-full bg-surface text-ink-muted shadow-[0_0_0_1px_var(--color-border-strong)] hover:text-ink"
      >
        <Pencil size={12} aria-hidden />
      </button>
      <Modal open={aberta} onClose={() => setAberta(false)} title="Editar categoria">
        {aberta && (
          <EditarPropria
            categoria={categoria}
            outras={outras}
            onFechar={() => {
              setAberta(false);
              router.refresh();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
