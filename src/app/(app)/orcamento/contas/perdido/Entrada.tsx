import Link from "next/link";
import { ChevronRight, Repeat, Search } from "lucide-react";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import type { CartaDaTela } from "./dados";

/**
 * A abinha "Dinheiro perdido" no alto de Recorrentes (protótipo B, com o ajuste da Dani: sem o
 * placar aqui). A pilha com os logos das cartas abertas, quantas são e o "Vamos lá?". Com extrato
 * novo, o selo "N novas".
 */
export function EntradaDoDinheiroPerdido({ abertas, novos }: { abertas: CartaDaTela[]; novos: number }) {
  const logos = abertas.slice(0, 3);
  const n = abertas.length;
  return (
    <Link
      href="/orcamento/contas/perdido"
      className="grid min-h-[84px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-3xl border px-4 py-3.5 active:scale-[0.99]"
      style={{
        background: "var(--heroi-fundo, linear-gradient(145deg, var(--color-heroi-de), var(--color-heroi-para)))",
        color: "var(--color-heroi-tinta)",
        borderColor: "var(--color-heroi-borda, transparent)",
        boxShadow: "var(--cartao-fio, none)",
      }}
    >
      {logos.length > 0 ? (
        <span className="relative h-14 shrink-0" style={{ width: 40 + (logos.length - 1) * 16 }} aria-hidden>
          {logos.map((c, i) => (
            <span key={c.chave} className="absolute rounded-xl" style={{ left: i * 16, top: i === 1 ? 4 : i === 2 ? 0 : 10, transform: `rotate(${[-10, -2, 8][i]}deg)`, zIndex: i }}>
              <LogoDoLancamento descricao={c.descricaoDoLogo} icon={Repeat} size={40} />
            </span>
          ))}
        </span>
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)]" aria-hidden>
          <Search size={22} strokeWidth={1.8} />
        </span>
      )}
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <b className="text-[17px] font-semibold leading-tight">Dinheiro perdido</b>
          {novos > 0 && <span className="rounded-full bg-accent px-2 py-px text-[11px] font-bold uppercase tracking-[0.06em] text-on-accent">{novos === 1 ? "1 nova" : `${novos} novas`}</span>}
        </span>
        <span className="block text-[14px] leading-snug text-heroi-suave">{n === 0 ? "Nada para conferir agora" : n === 1 ? "1 achado para conferir" : `${n} achados para conferir`}</span>
        {n > 0 && <span className="block text-[14px] font-semibold leading-snug">Vamos lá?</span>}
      </span>
      <ChevronRight size={20} strokeWidth={1.8} className="opacity-70" aria-hidden />
    </Link>
  );
}
