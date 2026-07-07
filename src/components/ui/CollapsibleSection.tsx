"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Esconde conteúdo denso (ex.: uma tabela longa) atrás de um toggle, com o gráfico/resumo já visível acima. */
export function CollapsibleSection({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-accent-strong hover:underline"
      >
        {label}
        <ChevronDown size={14} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && children}
    </div>
  );
}
