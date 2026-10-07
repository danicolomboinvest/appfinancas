import Link from "next/link";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { NumeroRolante } from "@/components/ui/NumeroRolante";
import type { Voz } from "@/lib/profiles/voice";
import { Card } from "@/components/ui/Card";
import { splitSavings, type SavingsTarget } from "@/lib/planning/savings-split";
import type { MoneyFormatter } from "@/lib/money";

const KIND_COLOR: Record<"reserva" | "meta" | "livre", string> = {
  reserva: "var(--color-success)",
  meta: "var(--color-accent)",
  livre: "var(--color-ink-faint)",
};

/** "Pra onde vai o que você guarda": o aporte do orçamento dividido entre reserva e metas. */
export function SavingsSplitCard({ amount, targets, money, monthLabel, voz }: { amount: number; targets: SavingsTarget[]; money: MoneyFormatter; monthLabel: string; voz: Voz }) {
  if (targets.length === 0) return null;
  if (amount <= 0) {
    return (
      <Card className="flex flex-col gap-1 border-accent/30 bg-accent-soft/30 p-4">
        <p className="text-[15px] font-semibold text-ink">{voz.titulos.splitVazioTitulo}</p>
        <p className="text-sm text-ink-muted">
          {voz.titulos.splitVazioSub}{" "}
          <Link href="/orcamento" className="font-medium text-accent-strong hover:underline">Definir →</Link>
        </p>
      </Card>
    );
  }
  const { slices } = splitSavings(amount, targets);
  // O herói da aba Metas (06/10/2026): quanto guardar no mês, grande, e a barra de para onde vai
  // cada parte. A regra da divisão ("reserva primeiro, depois as metas por prazo") fica no toque
  // do título, não escrita na tela para sempre.
  return (
    <HeroiDoTema>
      <p className="text-sm font-medium text-heroi-suave" title={voz.titulos.splitSub(money(amount, { round: true }))}>
        {voz.titulos.splitTitulo(monthLabel)}
      </p>
      <NumeroRolante texto={money(amount, { round: true })} className="text-[2.5rem] font-bold leading-none tracking-tight tabular-nums" />
      <div className="heroi-veu flex h-3 gap-0.5 overflow-hidden rounded-full">
        {slices.map((s) => (
          <span key={s.id} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.amount / amount) * 100}%`, backgroundColor: KIND_COLOR[s.kind] }} />
        ))}
      </div>
      {/* O nome à esquerda e o valor à direita, como a lista do aporte na Carteira (07/10/2026). */}
      <ul className="heroi-fio flex flex-col divide-y divide-[color-mix(in_srgb,var(--color-heroi-tinta)_12%,transparent)] border-t text-[15px]">
        {slices.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 py-2">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: KIND_COLOR[s.kind] }} />
            <span className="min-w-0 flex-1 truncate">{s.kind === "reserva" ? voz.titulos.modReserva : s.name}</span>
            <b className="shrink-0 font-semibold tabular-nums">{money(s.amount, { round: true })}</b>
          </li>
        ))}
      </ul>
    </HeroiDoTema>
  );
}
