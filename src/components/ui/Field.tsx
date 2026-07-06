import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const CONTROL_CLASSES =
  "rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function Field({
  label,
  error,
  className = "",
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-ink-muted">{label}</label>
      <input {...inputProps} className={`${CONTROL_CLASSES} ${className}`} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function SelectField({
  label,
  error,
  className = "",
  children,
  ...selectProps
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-ink-muted">{label}</label>
      <select {...selectProps} className={`${CONTROL_CLASSES} ${className}`}>
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
  ...textareaProps
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-ink-muted">{label}</label>
      <textarea {...textareaProps} className={`${CONTROL_CLASSES} ${className}`} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export { CONTROL_CLASSES };
