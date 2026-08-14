"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { CONTROL_CLASSES } from "./Field";

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function parseMonthValue(value: string): { year: number; month: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return null;
  return { year, month };
}

function toMonthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** "2029-09" → "setembro de 2029" no botão. */
function displayLabel(value: string): string | null {
  const parsed = parseMonthValue(value);
  if (!parsed) return null;
  return new Date(parsed.year, parsed.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/**
 * Seletor de mês/ano PRÓPRIO, com calendário de verdade em qualquer navegador. O input nativo
 * type="month" não tem calendário no Safari de computador (vira texto livre): a pessoa digitava
 * "09/29" e o valor chegava quebrado no servidor. Aqui é sempre a mesma coisa: toca, navega o
 * ano nas setas e escolhe o mês na grade — não tem como digitar errado.
 */
export function MonthPicker({
  label,
  value,
  onChange,
  min,
  max,
  name,
  placeholder = "Escolha o mês",
  error,
  id,
}: {
  label: string;
  /** "YYYY-MM" ou "" (nada escolhido ainda). */
  value: string;
  onChange: (value: string) => void;
  /** Limites opcionais, também "YYYY-MM". */
  min?: string;
  max?: string;
  /** Se presente, um input escondido leva o valor ("YYYY-MM") no submit do formulário. */
  name?: string;
  placeholder?: string;
  error?: string;
  id?: string;
}) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  // "down" abre abaixo do campo; "up" abre acima — usado quando o campo está perto do fim de
  // um modal com rolagem (senão o calendário nasce cortado pela borda do modal).
  const [placement, setPlacement] = useState<"down" | "up">("down");
  const selected = parseMonthValue(value);
  const [panelYear, setPanelYear] = useState(() => selected?.year ?? new Date().getFullYear());
  const containerRef = useRef<HTMLDivElement>(null);

  const minParsed = min ? parseMonthValue(min) : null;
  const maxParsed = max ? parseMonthValue(max) : null;

  // Fecha ao clicar/tocar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** Altura aproximada do painel (ano + grade de 3 linhas) + margem, pra decidir o lado. */
  const PANEL_HEIGHT = 240;

  function toggleOpen() {
    if (!open) {
      // Reabre sempre mostrando o ano do valor atual (ou o de hoje), nunca um ano "perdido".
      setPanelYear(selected?.year ?? new Date().getFullYear());
      // Se o campo está perto do fim do container com rolagem (ex.: modal) ou da tela, o
      // painel abriria cortado — nesse caso, abre pra CIMA.
      const container = containerRef.current;
      if (container) {
        let clipBottom = window.innerHeight;
        let ancestor = container.parentElement;
        while (ancestor && ancestor !== document.body) {
          if (getComputedStyle(ancestor).overflowY !== "visible") {
            clipBottom = Math.min(clipBottom, ancestor.getBoundingClientRect().bottom);
            break;
          }
          ancestor = ancestor.parentElement;
        }
        const spaceBelow = clipBottom - container.getBoundingClientRect().bottom;
        setPlacement(spaceBelow < PANEL_HEIGHT ? "up" : "down");
      }
    }
    setOpen((v) => !v);
  }

  function isDisabled(year: number, month: number): boolean {
    if (minParsed && (year < minParsed.year || (year === minParsed.year && month < minParsed.month))) return true;
    if (maxParsed && (year > maxParsed.year || (year === maxParsed.year && month > maxParsed.month))) return true;
    return false;
  }

  const yearAtMin = minParsed ? panelYear <= minParsed.year : false;
  const yearAtMax = maxParsed ? panelYear >= maxParsed.year : false;
  const label_ = displayLabel(value);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={buttonId} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <div ref={containerRef} className="relative">
        <button
          id={buttonId}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={toggleOpen}
          className={`${CONTROL_CLASSES} flex w-full cursor-pointer items-center justify-between gap-2 text-left`}
        >
          <span className={label_ ? "text-ink" : "text-ink-faint"}>{label_ ?? placeholder}</span>
          <CalendarDays className="size-4 shrink-0 text-ink-faint" aria-hidden />
        </button>

        {open && (
          <div
            role="dialog"
            aria-label={`Escolher mês e ano: ${label}`}
            className={`absolute left-0 right-0 z-40 rounded-xl border border-border-strong bg-surface p-3 shadow-premium ${
              placement === "up" ? "bottom-full mb-1" : "top-full mt-1"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Ano anterior"
                disabled={yearAtMin}
                onClick={() => setPanelYear((y) => y - 1)}
                className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <span className="text-sm font-semibold tabular-nums text-ink">{panelYear}</span>
              <button
                type="button"
                aria-label="Próximo ano"
                disabled={yearAtMax}
                onClick={() => setPanelYear((y) => y + 1)}
                className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {MONTH_SHORT.map((shortName, index) => {
                const month = index + 1;
                const disabled = isDisabled(panelYear, month);
                const isSelected = selected?.year === panelYear && selected?.month === month;
                return (
                  <button
                    key={shortName}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(toMonthValue(panelYear, month));
                      setOpen(false);
                    }}
                    className={`rounded-lg px-2 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                      isSelected ? "bg-ink font-semibold text-canvas" : "text-ink hover:bg-surface-2"
                    }`}
                  >
                    {shortName}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {name && <input type="hidden" name={name} value={value} />}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
