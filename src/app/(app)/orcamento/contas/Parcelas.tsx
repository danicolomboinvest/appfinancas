import { CreditCard } from "lucide-react";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { nomeNaTela } from "@/lib/import/nome-na-tela";
import type { Mes, ParcelaDoMes } from "@/lib/contas/parcelas-do-mes";

/**
 * Parcelas (13/10/2026): cada compra parcelada do mês, com o logo, o "9 de 10", quantas faltam
 * (contando a deste mês) e quando acaba. Vem das faturas (as lançadas e as que continuam) e das
 * contas parceladas. Só leitura: a parcela se muda no lançamento.
 */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function textoDaParcela(p: Pick<ParcelaDoMes, "atual" | "total" | "faltam" | "acabaEm">, hoje: Mes): string {
  if (p.faltam <= 1) return `${p.atual} de ${p.total} · última`;
  const ano = p.acabaEm.year !== hoje.year ? `/${String(p.acabaEm.year).slice(2)}` : "";
  return `${p.atual} de ${p.total} · faltam ${p.faltam} · até ${MESES[p.acabaEm.month - 1]}${ano}`;
}

export function Parcelas({ itens, total, hoje, m }: { itens: ParcelaDoMes[]; total: string; hoje: Mes; m: (v: number) => string }) {
  if (itens.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" data-parcelas>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="titulo-tema min-w-0 text-lg font-medium text-ink">
          Parcelas <span className="whitespace-nowrap text-sm font-normal text-ink-muted">{total}/mês</span>
        </h2>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
        {itens.map((p) => (
          <li key={p.chave} className="flex items-center gap-3 px-3 py-3">
            <LogoDoLancamento descricao={p.descricao} icon={CreditCard} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 break-words text-[16px] leading-snug text-ink">{nomeNaTela(p.nome).nome || p.nome}</span>
              <span className="block text-[13px] text-ink-muted">{textoDaParcela(p, hoje)}</span>
            </span>
            <span className="shrink-0 text-[16px] tabular-nums text-ink">{m(p.valor)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
