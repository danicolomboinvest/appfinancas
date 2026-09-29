"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type ToastAction = { label: string; onClick: () => void };
type ToastItem = { id: number; message: string; action?: ToastAction; erro?: boolean };
type ToastContextValue = {
  /** `action` opcional adiciona um botão (ex.: "Desfazer") e estende a duração do toast. */
  showToast: (message: string, action?: ToastAction) => void;
  /**
   * Algo deu errado. Antes todo toast era o de sucesso (check verde, 3 segundos): "Não foi
   * possível restaurar" aparecia com cara de "deu certo" e sumia antes de ser lido.
   */
  showError: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (item: Omit<ToastItem, "id">, duracao: number) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, ...item }]);
      setTimeout(() => dismiss(id), duracao);
    },
    [dismiss],
  );

  const showToast = useCallback(
    // Com ação (ex.: Desfazer) o toast dura mais, pra pessoa ter tempo de reagir.
    (message: string, action?: ToastAction) => push({ message, action }, action ? 6000 : 3000),
    [push],
  );
  // Erro fica mais tempo: é o que ela precisa ler pra saber o que fazer.
  const showError = useCallback((message: string) => push({ message, erro: true }, 6000), [push]);

  return (
    <ToastContext.Provider value={{ showToast, showError }}>
      {children}
      {/* No celular fica acima da barra de abas (ela é fixa e flutua no rodapé): antes o aviso
          nascia atrás dela, cortado. No computador não há barra, volta pro canto. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(6.5rem_+_env(safe-area-inset-bottom))] z-[200] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.erro ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-full items-center gap-3 rounded-lg border bg-surface-2 px-4 py-2.5 text-sm text-ink shadow-premium animate-fade-in ${
              toast.erro ? "border-danger/50" : "border-success/30"
            }`}
          >
            {toast.erro ? <AlertCircle size={16} className="shrink-0 text-danger" /> : <CheckCircle2 size={16} className="shrink-0 text-success" />}
            {toast.message}
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
                className="shrink-0 font-semibold text-accent-strong hover:underline"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast precisa ser usado dentro de um ToastProvider.");
  }
  return ctx;
}
