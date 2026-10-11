import { Check } from "lucide-react";
import { Cabecalho } from "../_ajustes/Lista";

export const metadata = { title: "Idioma · SPI Finance" };

export default function IdiomaPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Idioma" />
      <ul className="divide-y divide-border rounded-3xl border border-border bg-surface px-4">
        <li className="flex min-h-14 items-center justify-between gap-3">
          <span>
            <span className="block text-[16px] text-ink">Português (Brasil)</span>
            <span className="block text-[13px] text-ink-muted">Em uso</span>
          </span>
          <Check size={18} className="text-accent-strong" aria-hidden />
        </li>
        {["English", "Español"].map((l) => (
          <li key={l} className="flex min-h-14 flex-col justify-center opacity-60">
            <span className="block text-[16px] text-ink">{l}</span>
            <span className="block text-[13px] text-ink-muted">Em breve</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
