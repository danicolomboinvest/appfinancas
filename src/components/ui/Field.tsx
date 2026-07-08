"use client";

import { useId } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const CONTROL_CLASSES =
  "rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function Field({
  label,
  labelExtra,
  error,
  className = "",
  id,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Conteúdo extra ao lado do rótulo (ex.: um ícone de ajuda/tooltip). */
  labelExtra?: React.ReactNode;
  error?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="flex items-center text-xs font-medium text-ink-muted">
        {label}
        {labelExtra}
      </label>
      <input id={inputId} {...inputProps} className={`${CONTROL_CLASSES} ${className}`} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function SelectField({
  label,
  error,
  className = "",
  id,
  children,
  ...selectProps
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <select id={selectId} {...selectProps} className={`${CONTROL_CLASSES} ${className}`}>
        {children}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function TextareaField({
  label,
  error,
  className = "",
  id,
  ...textareaProps
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={textareaId} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <textarea id={textareaId} {...textareaProps} className={`${CONTROL_CLASSES} ${className}`} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export { CONTROL_CLASSES };
