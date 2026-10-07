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
        aria-expanded={open}
        // Cinza, não dourado (07/10/2026): dourado é para ação, e o link dourado com setinha
        // ("Editar meus dados ▾") a Dani achou que tinha cara de IA.
        className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        {label}
        <ChevronDown size={14} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {/* Recolher esconde, não desmonta: dentro daqui moram formulários (o plano do orçamento, os
          parâmetros do acúmulo, a nota da ficha), e desmontar jogava fora tudo o que ela tinha
          digitado sem aviso. `contents` deixa o layout igual ao de quando o filho vinha direto. */}
      <div className={open ? "contents" : "hidden"}>{children}</div>
    </div>
  );
}
