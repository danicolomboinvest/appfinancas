import { Search, X } from "lucide-react";
import Link from "next/link";

/**
 * Busca de cliente no Admin (13/10/2026, pedido da Dani): um formulário GET simples com ?q=, para
 * a busca ficar no endereço e funcionar sem JavaScript. Os outros parâmetros (ordem) seguem junto.
 */
export function BuscaCliente({ acao, q, extras = {}, placeholder = "Buscar por nome, e-mail ou celular" }: { acao: string; q: string; extras?: Record<string, string>; placeholder?: string }) {
  return (
    <form action={acao} method="get" role="search" className="flex items-center gap-2">
      {Object.entries(extras).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="flex min-h-11 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 focus-within:border-accent">
        <Search size={16} className="shrink-0 text-ink-muted" aria-hidden />
        <span className="sr-only">Buscar cliente</span>
        <input type="search" name="q" defaultValue={q} placeholder={placeholder} autoComplete="off" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
      </label>
      <button type="submit" className="min-h-11 rounded-full bg-ink px-5 text-sm font-medium text-canvas">
        Buscar
      </button>
      {q && (
        <Link href={acao + (Object.keys(extras).length ? `?${new URLSearchParams(extras)}` : "")} aria-label="Limpar busca" className="flex size-11 items-center justify-center rounded-full border border-border text-ink-muted">
          <X size={16} aria-hidden />
        </Link>
      )}
    </form>
  );
}

/** Sem acento, sem caixa e só dígitos no celular: "Vitória" acha "vitoria", "(11) 98765" acha "11987". */
export function bateComBusca(q: string, ...campos: (string | null | undefined)[]): boolean {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const termo = norm(q);
  if (!termo) return true;
  const digitos = termo.replace(/\D/g, "");
  return campos.some((c) => {
    if (!c) return false;
    if (norm(c).includes(termo)) return true;
    return digitos.length >= 4 && c.replace(/\D/g, "").includes(digitos);
  });
}
