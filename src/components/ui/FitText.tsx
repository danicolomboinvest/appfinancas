"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// useLayoutEffect no cliente (evita o "flash" do número grande antes de encolher); useEffect no
// servidor pra não emitir warning de SSR.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Encolhe o texto pra caber na largura do container (item 9). Números grandes, patrimônio,
 * saldo, não estouram nem são cortados num celular estreito: a fonte reduz só o necessário e
 * nunca aumenta além do tamanho definido no `className`. Mede a largura natural (o `scale` via
 * transform não altera `scrollWidth`), então não há laço de realimentação.
 */
export function FitText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useIsoLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const available = outer.clientWidth;
      const needed = inner.scrollWidth;
      if (!available || !needed) return;
      const next = needed > available ? available / needed : 1;
      setScale(next);
      // O transform não encolhe a altura de layout, ajustamos na mão pra não sobrar espaço.
      setHeight(next < 1 ? inner.offsetHeight * next : undefined);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={outerRef} className="w-full overflow-hidden" style={{ height }}>
      <span
        ref={innerRef}
        className={`inline-block origin-top-left whitespace-nowrap ${className}`}
        style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
      >
        {children}
      </span>
    </div>
  );
}
