import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import type { InfoDaCategoria } from "./dados";
import type { DetalheDoNumero, ForaDoNumero, LancamentoDoNumero } from "./detalhe-do-numero";
import type { Mes } from "./regras";

const CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dd = (n: number) => String(n).padStart(2, "0");

/**
 * Um lado da folha "O que entrou nos R$ 2.282": as categorias que somam o número (tocar abre os
 * lançamentos), a linha "Fora da conta" e o "Ver em Transações" do mesmo período. Sem estado: as
 * categorias abrem com <details>, quem troca de mês é o AbrirDetalhe.
 */
export function PainelDoNumero({ d, mes, info, money }: { d: DetalheDoNumero; mes: Mes; info: Record<string, InfoDaCategoria>; money: (v: number) => string }) {
  const quando = (g: LancamentoDoNumero) => (g.dia === null ? "sem dia" : g.dia > 31 ? "mês seguinte" : `${g.dia} ${CURTO[mes.mes - 1]}`);
  const de = `${mes.ano}-${dd(mes.mes)}-01`;
  const ate = `${mes.ano}-${dd(mes.mes)}-${dd(d.corte)}`;
  const linha = (g: LancamentoDoNumero, sub: string) => {
    const c = info[g.categoria];
    return (
      <li key={g.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2" data-lancamento-do-numero>
        <LogoDoLancamento descricao={g.descricao} icon={c.icone} cor={c.cor} size={36} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] text-ink">{g.descricao}</span>
          <span className="text-[12.5px] text-ink-muted">{sub}</span>
        </span>
        <span className="text-[14px] tabular-nums text-ink">{money(g.valor)}</span>
      </li>
    );
  };
  const motivo = (g: ForaDoNumero) => (g.motivo === "aplicacao" ? "aplicação, é guardar" : `depois do dia ${d.corte}`);
  return (
    <div className="flex flex-col gap-3" data-painel-do-numero={`${mes.ano}-${mes.mes}`}>
      <p className="text-center text-[13px] text-ink-muted">
        {d.n === 1 ? "1 lançamento" : `${d.n} lançamentos`} de 1 a {d.corte} {CURTO[mes.mes - 1]}
      </p>
      {d.categorias.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-ink-muted">Nenhum gasto neste período.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl bg-surface px-3 shadow-[inset_0_0_0_1px_var(--color-border)]">
          {d.categorias.map((cat) => {
            const c = info[cat.categoria];
            return (
              <li key={cat.categoria}>
                <details className="group">
                  <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5 [&::-webkit-details-marker]:hidden" data-categoria-do-numero={cat.categoria} data-total={cat.total}>
                    <CategoryIcon icon={c.icone} color={c.cor} size={36} />
                    <span className="flex min-w-0 flex-col">
                      <b className="truncate text-[15px] font-semibold text-ink">{c.nome}</b>
                      <span className="text-[12.5px] text-ink-muted">{cat.itens.length === 1 ? "1 lançamento" : `${cat.itens.length} lançamentos`}</span>
                    </span>
                    <b className="text-[15px] font-semibold tabular-nums text-ink">{money(cat.total)}</b>
                    <ChevronDown size={16} className="text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <ul className="flex flex-col divide-y divide-border pb-1">{cat.itens.map((g) => linha(g, quando(g)))}</ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {d.fora.length > 0 && (
        <details className="group px-1" data-fora-da-conta>
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-[13px] text-ink-muted [&::-webkit-details-marker]:hidden">
            Fora da conta: {d.fora.length === 1 ? "1 lançamento" : `${d.fora.length} lançamentos`}
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="flex flex-col divide-y divide-border">{d.fora.map((g) => linha(g, `${quando(g)} · ${motivo(g)}`))}</ul>
        </details>
      )}
      <Link href={`/mensal/periodo?de=${de}&ate=${ate}`} className="flex min-h-11 items-center justify-center gap-1 text-[14px] font-semibold text-ink">
        Ver em Transações <ChevronRight size={15} aria-hidden />
      </Link>
    </div>
  );
}
