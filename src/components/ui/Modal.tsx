"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Modal centralizado no desktop, vira um drawer que sobe da base no mobile. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <button aria-label="Fechar" onClick={onClose} className="fixed inset-0 bg-black/60" />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg animate-fade-in overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-premium sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
