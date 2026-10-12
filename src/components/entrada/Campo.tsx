"use client";

import { useState, type ComponentPropsWithRef, type ComponentType, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

type Icone = ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }>;

/**
 * O campo das telas de entrada (Mockup A): rótulo em cima, caixa branca de 56px com o ícone à
 * esquerda e, na senha, o olho de mostrar. A caixa ganha o contorno de tinta quando está em uso
 * e o vermelho quando o servidor apontou um problema nela.
 *
 * `rotuloVisivel={false}` é para a tela de uma pergunta só (a nova senha em dois passos): a
 * pergunta grande já é o rótulo, e o <label> fica só para o leitor de tela.
 */
export function Campo({
  rotulo,
  extraDoRotulo,
  icone: I,
  id,
  type = "text",
  invalido = false,
  descritoPor,
  rotuloVisivel = true,
  grande = false,
  className = "",
  ...props
}: Omit<ComponentPropsWithRef<"input">, "id"> & {
  rotulo: string;
  extraDoRotulo?: ReactNode;
  icone?: Icone;
  id: string;
  invalido?: boolean;
  /** Ids dos avisos que explicam este campo (erro do servidor, regra da senha). */
  descritoPor?: string;
  rotuloVisivel?: boolean;
  grande?: boolean;
}) {
  const senha = type === "password";
  const [visivel, setVisivel] = useState(false);
  const contorno = invalido
    ? "shadow-[inset_0_0_0_2px_var(--color-danger)]"
    : "shadow-[inset_0_0_0_1.5px_var(--color-border-strong),0_1px_2px_rgba(0,0,0,0.04)] focus-within:shadow-[inset_0_0_0_2px_var(--color-ink)]";
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={id} className={rotuloVisivel ? "text-sm font-semibold text-ink" : "sr-only"}>
        {rotulo}
        {extraDoRotulo}
      </label>
      <div
        className={`flex items-center gap-2.5 rounded-[18px] bg-surface px-4 text-ink-muted transition-shadow ${grande ? "h-16" : "h-14"} ${contorno}`}
      >
        {I && <I size={20} strokeWidth={1.6} aria-hidden className="shrink-0" />}
        <input
          id={id}
          type={senha && visivel ? "text" : type}
          aria-invalid={invalido || undefined}
          aria-describedby={descritoPor || undefined}
          {...props}
          className={`h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-faint read-only:text-ink-muted ${grande ? "text-[22px]" : "text-base"} ${className}`}
        />
        {senha && (
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? "Esconder a senha" : "Mostrar a senha"}
            aria-pressed={visivel}
            aria-controls={id}
            className="-mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ink"
          >
            {visivel ? <EyeOff size={20} strokeWidth={1.6} aria-hidden /> : <Eye size={20} strokeWidth={1.6} aria-hidden />}
          </button>
        )}
      </div>
    </div>
  );
}
