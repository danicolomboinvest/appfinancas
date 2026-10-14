import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import type { LinhaDeCategoria } from "./dados";
import { direcao } from "./regras";

/**
 * As categorias que mais mudaram, com as duas barrinhas (agora e antes) e a diferença. O Resumo
 * do mês de agora e o de um mês passado usam o mesmo desenho. Sem comparação (o mês anterior não
 * está no app), só o valor e a barra de cada uma.
 */
export function ListaDeCategorias({ titulo, linhas, money, href, comparar = true }: { titulo: string; linhas: LinhaDeCategoria[]; money: (v: number) => string; href: string; comparar?: boolean }) {
  const topo = Math.max(1, ...linhas.flatMap((c) => (comparar ? [c.atual, c.passado] : [c.atual])));
  return (
    <section className="flex flex-col gap-2.5" data-bloco-categorias>
      <h2 className="px-1 text-base font-semibold text-ink">{titulo}</h2>
      <Card className="flex flex-col p-1.5">
        {linhas.map((c) => {
          const d = direcao(c.diferenca);
          return (
            <Link key={c.chave} href={href} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface-2">
              <CategoryIcon icon={c.icone} color={c.cor} size={40} />
              <span className="flex min-w-0 flex-col gap-1">
                <b className="truncate text-[15px] font-semibold text-ink">{c.nome}</b>
                <span className="text-[12.5px] text-ink-muted">{c.compras === 1 ? "1 compra" : `${c.compras} compras`}</span>
                <span className="flex flex-col gap-[3px]" aria-hidden>
                  <i className="h-1.5 rounded-full" style={{ width: `${Math.max(3, (c.atual / topo) * 100)}%`, background: c.cor }} />
                  {comparar && <i className="h-1.5 rounded-full" style={{ width: `${Math.max(3, (c.passado / topo) * 100)}%`, background: c.cor, opacity: 0.38 }} />}
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <b className="text-[15px] font-semibold tabular-nums text-ink">{money(c.atual)}</b>
                {comparar && (
                  <span className={`whitespace-nowrap text-[12.5px] font-medium ${d === "menos" ? "text-success" : d === "mais" ? "text-accent-strong" : "text-ink-muted"}`}>
                    {d === "igual" ? "igual" : `${money(Math.abs(c.diferenca))} a ${d}`}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
        <Link href={href} className="flex min-h-11 items-center justify-center gap-1 text-[14px] font-semibold text-ink">
          Ver todas as categorias <ChevronRight size={15} aria-hidden />
        </Link>
      </Card>
    </section>
  );
}
