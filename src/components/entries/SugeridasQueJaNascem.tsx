"use client";

import { useState, useTransition } from "react";
import { CUSTOM_CATEGORY_ICON_MAP } from "@/lib/categories";
import { sugeridasQueFaltam, type CategoriaQueJaNasce } from "@/lib/categorias/que-ja-nascem";
import { createCategoryAction } from "@/lib/actions/category";

/**
 * A linha "Sugeridas" (30/10/2026): chips com as categorias que já nascem no perfil novo (Beleza,
 * Roupas, Pet...) e que esta pessoa ainda não tem. Um toque cria, com o ícone e a cor de sempre,
 * e some da linha. Sem nada faltando, a linha não aparece. Nada de modal nem de explicação.
 */
export function SugeridasQueJaNascem({ existentes, onCriada }: { existentes: string[]; onCriada: (c: { id: string; name: string; icon: string }) => void }) {
  const [criadas, setCriadas] = useState<string[]>([]);
  const [criando, setCriando] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const faltam = sugeridasQueFaltam([...existentes, ...criadas].map((name) => ({ name })));
  if (faltam.length === 0) return null;

  function criar(c: CategoriaQueJaNasce) {
    if (criando) return;
    setCriando(c.nome);
    iniciar(async () => {
      const r = await createCategoryAction(c.nome, { icone: c.icone, cor: c.cor }).catch(() => ({ ok: false as const, error: "" }));
      setCriando(null);
      if (!r.ok) return;
      setCriadas((v) => [...v, c.nome]);
      onCriada({ id: r.id, name: r.name, icon: c.icone });
    });
  }

  return (
    <div className="flex flex-col gap-1.5" data-sugeridas>
      <span className="text-xs font-medium text-ink-muted">Sugeridas</span>
      <div className="flex flex-wrap gap-2">
        {faltam.map((c) => {
          const I = CUSTOM_CATEGORY_ICON_MAP[c.icone];
          return (
            <button
              key={c.assunto}
              type="button"
              disabled={criando !== null}
              aria-busy={criando === c.nome}
              onClick={() => criar(c)}
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-surface px-3 text-sm text-ink ring-1 ring-border disabled:opacity-60"
            >
              {I && <I size={15} strokeWidth={1.8} aria-hidden />}
              {c.nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}
