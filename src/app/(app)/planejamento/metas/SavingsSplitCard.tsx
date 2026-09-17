import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { splitSavings, type SavingsTarget } from "@/lib/planning/savings-split";
import type { MoneyFormatter } from "@/lib/money";

const KIND_COLOR: Record<"reserva" | "meta" | "livre", string> = {
  reserva: "var(--color-success)",
  meta: "var(--color-accent)",
  livre: "var(--color-ink-faint)",
};

/** "Pra onde vai o que você guarda": o aporte do orçamento dividido entre reserva e metas. */
export function SavingsSplitCard({ amount, targets, money, monthLabel }: { amount: number; targets: SavingsTarget[]; money: MoneyFormatter; monthLabel: string }) {
  if (targets.length === 0) return null;
  if (amount <= 0) {
    return (
      <Card className="flex flex-col gap-1 border-accent/30 bg-accent-soft/30 p-4">
        <p className="text-[15px] font-semibold text-ink">Pra onde vai o que você guarda?</p>
        <p className="text-sm text-ink-muted">
          Diga no orçamento quanto quer guardar por mês, e o app divide entre reserva e metas.{" "}
          <Link href="/orcamento" className="font-medium text-accent-strong hover:underline">Definir →</Link>
        </p>
      </Card>
    );
  }
  const { slices } = splitSavings(amount, targets);
  return (
    <Card className="flex flex-col gap-3 border-accent/30 bg-accent-soft/30 p-4">
      <div>
        <p className="text-[15px] font-semibold text-ink">Pra onde vai o que você guarda em {monthLabel}</p>
        <p className="text-caption text-ink-muted">{money(amount, { round: true })} por mês, do seu orçamento. Reserva primeiro, depois as metas por prazo.</p>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
        {slices.map((s) => (
          <span key={s.id} className="h-full" style={{ width: `${(s.amount / amount) * 100}%`, backgroundColor: KIND_COLOR[s.kind] }} />
        ))}
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.id} className="flex items-baseline gap-2">
            <span className="mt-1 size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: KIND_COLOR[s.kind] }} />
            <b className="shrink-0 tabular-nums text-ink">{money(s.amount, { round: true })}</b>
            <span className="min-w-0 text-ink-muted">→ {s.name}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
