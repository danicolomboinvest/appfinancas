"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2 } from "lucide-react";

type ToastItem = { id: number; message: string };
type ToastContextValue = { showToast: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col gap-2 sm:bottom-6 sm:right-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-success/30 bg-surface-2 px-4 py-2.5 text-sm text-ink shadow-premium animate-fade-in"
          >
            <CheckCircle2 size={16} className="shrink-0 text-success" />
            {toast.message}
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
