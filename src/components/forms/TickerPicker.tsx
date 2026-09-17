"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONTROL_CLASSES } from "@/components/ui/Field";
import { searchTickersAction } from "@/lib/market/actions";
import { KIND_LABEL, type TickerHit, type TickerKind } from "@/lib/market/ticker-search";

type Hit = Pick<TickerHit, "ticker" | "name" | "kind">;

/**
 * Campo de código de ativo pra quem NÃO sabe o código.
 *
 * Digita "petro" e aparece PETR4 Petrobras; digita "kinea" e aparecem os fundos da Kinea.
 * Com o campo vazio, ao tocar, abre a lista dos mais negociados — dá pra rolar e reconhecer
 * um nome. Quem sabe o código digita direto e o campo continua um input comum: o valor que
 * vai no form é o texto, selecionado da lista ou não.
 *
 * Se o form tem um campo de nome (`companyNameField`), a escolha na lista preenche o nome
 * junto, num input escondido — a pessoa não digita duas vezes.
 */
export function TickerPicker({
  kinds,
  name = "ticker",
  companyNameField,
  label,
  placeholder,
  defaultValue = "",
  required,
  className = "",
  onSelect,
}: {
  kinds: TickerKind[];
  name?: string;
  companyNameField?: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
  onSelect?: (hit: Hit) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState(defaultValue);
  const [chosen, setChosen] = useState<Hit | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  /** Onde a lista cai na tela: logo abaixo do input, na largura dele. */
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const kindsKey = kinds.join(",");

  // Busca com um respiro de 180ms depois da última tecla; a resposta de uma busca antiga que
  // chega atrasada é ignorada (requestId), senão "pet" podia sobrescrever "petr".
  useEffect(() => {
    if (!open) return;
    const mine = ++requestId.current;
    const timer = setTimeout(() => {
      searchTickersAction(text, kindsKey.split(",") as TickerKind[]).then(
        (res) => {
          if (requestId.current !== mine) return;
          setHits(res);
          setLoading(false);
          setActive(-1);
        },
        () => {
          if (requestId.current === mine) setLoading(false);
        },
      );
    }, 180);
    return () => clearTimeout(timer);
  }, [text, open, kindsKey]);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  // A lista vai por portal pro <body>: dentro do card (overflow hidden) ela era cortada na
  // segunda linha, e dentro de um modal ficaria presa ao rolar. Posição fixa, medida do input,
  // refeita ao rolar ou redimensionar enquanto estiver aberta.
  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  function choose(hit: Hit) {
    setText(hit.ticker);
    setChosen(hit);
    setOpen(false);
    onSelect?.(hit);
  }

  function startSearch() {
    setLoading(true);
    setOpen(true);
  }

  const matchesChosen = chosen && chosen.ticker === text.trim().toUpperCase();
  const showList = open && (loading || hits.length > 0 || text.trim().length > 0);
  const showKind = new Set(hits.map((h) => h.kind)).size > 1;

  return (
    <div ref={rootRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required={required}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setChosen(null);
          startSearch();
        }}
        onFocus={startSearch}
        onClick={() => {
          if (!open) startSearch();
        }}
        onBlur={() => {
          // Código sem escolher na lista: sobe pra maiúscula, que é como o resto do app lê.
          const t = text.trim();
          if (t && /^[a-z0-9.]{1,7}$/i.test(t)) setText(t.toUpperCase());
        }}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && active >= 0 && hits[active]) {
            e.preventDefault();
            choose(hits[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`${CONTROL_CLASSES} w-full`}
      />
      {companyNameField && <input type="hidden" name={companyNameField} value={matchesChosen ? chosen.name : ""} />}
      {matchesChosen && chosen.name && <p className="text-caption text-ink-muted">{chosen.name}</p>}

      {showList &&
        rect &&
        createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, maxHeight: Math.max(160, Math.min(288, window.innerHeight - rect.top - 16)) }}
          className="z-[110] overflow-y-auto rounded-lg border border-border-strong bg-surface-2 shadow-premium-sm"
        >
          {text.trim() === "" && hits.length > 0 && (
            <p className="sticky top-0 border-b border-border bg-surface-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              Mais negociados
            </p>
          )}
          {hits.map((hit, i) => (
            <button
              key={hit.ticker}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(hit)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-baseline gap-2 px-3 py-2 text-left ${i === active ? "bg-accent-soft" : ""}`}
            >
              <span className="w-[4.5rem] shrink-0 text-sm font-semibold tabular-nums text-ink">{hit.ticker}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{hit.name || "—"}</span>
              {showKind && <span className="shrink-0 text-[10px] uppercase text-ink-faint">{KIND_LABEL[hit.kind]}</span>}
            </button>
          ))}
          {!loading && hits.length === 0 && text.trim() !== "" && (
            <p className="px-3 py-2 text-xs text-ink-faint">Nada com esse nome. Se você sabe o código, pode digitar mesmo assim.</p>
          )}
          {loading && hits.length === 0 && <p className="px-3 py-2 text-xs text-ink-faint">Buscando…</p>}
        </div>,
        document.body,
        )}
    </div>
  );
}
