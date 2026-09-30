"use client";

import { useId, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { CONTROL_CLASSES } from "./Field";

/**
 * Campo de senha com o olho de mostrar/esconder.
 *
 * Existe porque no celular a senha vira bolinha na hora e quem erra uma letra só descobre no
 * "senha errada" do login, dias depois. Ver o que digitou resolve isso sem pedir "repita a senha".
 * O botão tem 44px de área de toque (mesmo que o desenho do olho seja pequeno) e fica por cima
 * da borda direita do campo, que ganha espaço pra o texto não passar por baixo dele.
 */
export function PasswordField({
  label,
  error,
  className = "",
  id,
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; error?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          {...inputProps}
          type={visivel ? "text" : "password"}
          className={`${CONTROL_CLASSES} w-full pr-12 ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Esconder a senha" : "Mostrar a senha"}
          aria-pressed={visivel}
          aria-controls={inputId}
          className="absolute right-0 top-1/2 -mt-[22px] flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:text-ink"
        >
          {visivel ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
