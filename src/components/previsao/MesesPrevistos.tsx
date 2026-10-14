import Link from "next/link";
import { ChevronRight, CreditCard, Receipt, Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { NUMERO_DESTAQUE, ValorDestaque } from "@/components/ui/ValorDestaque";
import { fraseDoQueAcaba, type ItemPrevisto, type MesPrevisto } from "@/lib/previsao/proximos-meses";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nome = (m: { mes: number }) => MESES[m.mes - 1];
const Nome = (m: { mes: number }) => nome(m).charAt(0).toUpperCase() + nome(m).slice(1);
type Money = (v: number) => string;

/** A barra do comprometido contra a renda média: destaque do tema sobre o tom suave dele, sem cinza. */
function Barra({ pct, grossa = false }: { pct: number | null; grossa?: boolean }) {
  const largura = pct === null ? 0 : Math.min(100, Math.max(2, pct));
  return (
    <div className={`${grossa ? "h-2.5" : "h-1.5"} w-full overflow-hidden rounded-full bg-accent-soft`} aria-hidden>
      <div className="h-full rounded-full bg-accent" style={{ width: `${largura}%` }} />
    </div>
  );
}

/**
 * "Próximos meses" no Resumo (14/10/2026): por mês, o que já está comprometido (parcelas, contas e
 * assinaturas) contra a renda média, e a parcela que acaba. Tocar abre o mês, marcado como previsto.
 */
export function ProximosMeses({ meses, money, href }: { meses: MesPrevisto[]; money: Money; href: (m: MesPrevisto) => string }) {
  if (meses.every((m) => m.total < 1)) return null;
  return (
    <section className="flex flex-col gap-2.5" data-proximos-meses>
      <h2 className="px-1 text-base font-semibold text-ink">Próximos meses</h2>
      <Card className="flex flex-col p-1.5">
        {meses.map((m) => {
          const acaba = fraseDoQueAcaba(nome(m), m.acabaram, money);
          return (
            <Link key={`${m.ano}-${m.mes}`} href={href(m)} className="flex flex-col gap-1.5 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2">
              <span className="flex items-baseline justify-between gap-3">
                <b className="text-[15px] font-semibold text-ink">{Nome(m)}</b>
                <span className="flex items-center gap-1 text-[14px] tabular-nums text-ink">
                  <b className="font-semibold">{money(m.total)}</b>
                  {m.rendaMedia !== null && <span className="text-ink-muted">de {money(m.rendaMedia)}</span>}
                  <ChevronRight size={15} className="text-ink-muted" aria-hidden />
                </span>
              </span>
              <Barra pct={m.pct} />
              {acaba && <span className="text-[13px] font-medium text-accent-strong">{acaba}</span>}
            </Link>
          );
        })}
      </Card>
      <p className="px-1 text-[12.5px] text-ink-muted">Previsto: parcelas, contas e assinaturas, contra a renda média.</p>
    </section>
  );
}

function Grupo({ titulo, Icone, itens, money }: { titulo: string; Icone: typeof Receipt; itens: ItemPrevisto[]; money: Money }) {
  if (itens.length === 0) return null;
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden>
          <Icone size={18} />
        </span>
        <b className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{titulo}</b>
        <b className="text-[15px] font-semibold tabular-nums text-ink">{money(total)}</b>
      </div>
      <ul className="mt-2 flex flex-col">
        {[...itens].sort((a, b) => b.valor - a.valor).map((i, k) => (
          <li key={i.nome + k} className="flex items-baseline justify-between gap-3 py-1.5 text-[14px]">
            <span className="min-w-0 break-words text-ink-muted">{i.nome}</span>
            <span className="shrink-0 tabular-nums text-ink">{money(i.valor)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * O mês que ainda não chegou (Resumo e Transações, com o seletor num mês futuro): o que já está
 * comprometido, por tipo, sempre escrito como previsto. Nunca vira gasto.
 */
export function MesPrevistoNaTela({ m, money }: { m: MesPrevisto; money: Money }) {
  const acaba = fraseDoQueAcaba(nome(m), m.acabaram, money);
  return (
    <div className="flex flex-col gap-4" data-mes-previsto>
      <HeroiDoTema>
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[color-mix(in_srgb,var(--color-heroi-tinta)_12%,transparent)] px-2.5 py-0.5 text-[12.5px] font-semibold">Previsto</span>
          <span className="text-[15px] text-heroi-suave">{Nome(m)}, já comprometido</span>
        </span>
        <ValorDestaque texto={money(m.total)} className={NUMERO_DESTAQUE} />
        <p className="-mt-1 text-[14px]">
          {m.rendaMedia !== null ? (
            <>
              {m.pct}% da renda média de <b className="font-semibold">{money(m.rendaMedia)}</b>.
            </>
          ) : (
            "Parcelas, contas e assinaturas que você já tem."
          )}
        </p>
        {m.rendaMedia !== null && <Barra pct={m.pct} grossa />}
        {acaba && <p className="text-[14px] font-medium">{acaba}</p>}
      </HeroiDoTema>
      <Grupo titulo="Parcelas" Icone={CreditCard} itens={m.parcelas} money={money} />
      <Grupo titulo="Contas" Icone={Receipt} itens={m.contas} money={money} />
      <Grupo titulo="Assinaturas" Icone={Repeat} itens={m.assinaturas} money={money} />
      {m.total < 1 && <Card className="p-4 text-[15px] text-ink">Nada previsto ainda para {nome(m)}. Parcelas, contas e assinaturas aparecem aqui sozinhas.</Card>}
      <p className="px-1 text-[12.5px] text-ink-muted">Previsto pelo que você já tem em Recorrentes e pelas parcelas dos extratos. Muda quando o mês chegar.</p>
    </div>
  );
}
