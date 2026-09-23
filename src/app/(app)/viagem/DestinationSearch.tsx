"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, MapPin } from "lucide-react";
import { searchDestinations, type TravelDestination } from "@/lib/travel/estimates";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

/**
 * Busca de destino: digita e a lista aparece embaixo (sem acento, por nome, país ou apelido —
 * "ny", "jeri", "noronha"). O painel é `w-full` de propósito: preso à largura do campo, nunca
 * pode vazar da tela no celular (o balão de ajuda já ensinou essa lição).
 */
export function DestinationSearch({
  onPick,
  excludeKeys,
  disabled,
}: {
  onPick: (destination: TravelDestination) => void;
  /** Destinos já adicionados à viagem — não aparecem de novo na lista. */
  excludeKeys: string[];
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const { titulos: t } = useProfileTheme().voz;

  const results = useMemo(() => {
    const excluded = new Set(excludeKeys);
    return searchDestinations(query, 40)
      .filter((dest) => !excluded.has(dest.key))
      .slice(0, 12);
  }, [query, excludeKeys]);

  // Clique fora fecha a lista (no celular, tocar em qualquer outro lugar).
  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  function pick(destination: TravelDestination) {
    onPick(destination);
    setQuery("");
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      setHighlight((current) => {
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        if (results.length === 0) return 0;
        return (next + results.length) % results.length;
      });
      return;
    }
    if (event.key === "Enter") {
      // Enter escolhe da lista em vez de enviar o formulário inteiro.
      event.preventDefault();
      const chosen = results[highlight] ?? results[0];
      if (chosen) pick(chosen);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label="Buscar destino"
          placeholder={t.viagemBuscarPlaceholder}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-border-strong bg-surface-2 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        />
      </div>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border-strong bg-surface shadow-premium">
          {results.length === 0 ? (
            <p id={listboxId} role="listbox" className="px-3 py-3 text-sm text-ink-faint">
              {t.viagemNenhumDestino}
            </p>
          ) : (
            <ul id={listboxId} role="listbox">
              {results.map((destination, index) => (
                <li key={destination.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlight}
                    onPointerEnter={() => setHighlight(index)}
                    onClick={() => pick(destination)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      index === highlight ? "bg-surface-2" : ""
                    }`}
                  >
                    <MapPin className="size-4 shrink-0 text-ink-faint" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{destination.label}</span>
                      <span className="block truncate text-xs text-ink-faint">
                        {destination.country} · {destination.region}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
